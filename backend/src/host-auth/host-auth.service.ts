import {
  ForbiddenException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { isPasswordHash, verifyHostPassword } from './password.js';

interface Session {
  authenticated: boolean;
  csrfToken: string;
  expiresAt: number;
}
interface Attempts {
  count: number;
  expiresAt: number;
}
const hostLifetime = 60 * 60 * 1000;
const anonymousLifetime = 10 * 60 * 1000;
const attemptWindow = 15 * 60 * 1000;

@Injectable()
export class HostAuthService {
  private readonly sessions = new Map<string, Session>();
  private readonly attempts = new Map<string, Attempts>();
  private activeVerifications = 0;
  // Production supplies a separate secret; local sessions use a process-local key.
  private readonly signingKey =
    process.env.SESSION_SECRET || randomBytes(32).toString('hex');

  private signature(id: string): string {
    return createHmac('sha256', this.signingKey).update(id).digest('hex');
  }

  private get secure(): boolean {
    return process.env.NODE_ENV === 'production';
  }
  private get cookieName(): string {
    return this.secure ? '__Host-unblock_host' : 'unblock_host';
  }
  private get cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.secure, sameSite: 'lax', path: '/' };
  }

  private token(): string {
    return randomBytes(32).toString('hex');
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions)
      if (session.expiresAt <= now) this.sessions.delete(id);
    for (const [ip, attempts] of this.attempts)
      if (attempts.expiresAt <= now) this.attempts.delete(ip);
  }

  private sessionId(request: Request): string | undefined {
    const cookie = request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${this.cookieName}=`));
    const value = cookie?.slice(this.cookieName.length + 1);
    if (!value || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value)) return undefined;
    const [id, signature] = value.split('.');
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(this.signature(id), 'hex'),
    )
      ? id
      : undefined;
  }

  private getSession(request: Request): Session | undefined {
    this.prune();
    const id = this.sessionId(request);
    return id ? this.sessions.get(id) : undefined;
  }

  private issueSession(response: Response, authenticated: boolean): Session {
    this.prune();
    if (this.sessions.size >= 1000)
      throw new ServiceUnavailableException(
        'Host access is temporarily unavailable',
      );
    const lifetime = authenticated ? hostLifetime : anonymousLifetime;
    const session = {
      authenticated,
      csrfToken: this.token(),
      expiresAt: Date.now() + lifetime,
    };
    const id = this.token();
    this.sessions.set(id, session);
    response.cookie(this.cookieName, `${id}.${this.signature(id)}`, {
      ...this.cookieOptions,
      maxAge: lifetime,
    });
    return session;
  }

  private publicSession(session: Session) {
    return {
      authenticated: session.authenticated,
      csrfToken: session.csrfToken,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  private allowedOrigin(request: Request): boolean {
    return (
      request.get('origin') ===
      (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    );
  }

  session(request: Request, response: Response) {
    if (request.get('origin') && !this.allowedOrigin(request))
      throw new ForbiddenException('Request origin is not allowed');
    response.setHeader('Cache-Control', 'no-store');
    return this.publicSession(
      this.getSession(request) ?? this.issueSession(response, false),
    );
  }

  private checkCsrf(request: Request, session: Session): void {
    const token = request.get('x-csrf-token');
    if (
      !this.allowedOrigin(request) ||
      !token ||
      !/^[a-f0-9]{64}$/.test(token) ||
      !timingSafeEqual(
        Buffer.from(token, 'hex'),
        Buffer.from(session.csrfToken, 'hex'),
      )
    ) {
      throw new ForbiddenException(
        'Request verification failed. Refresh the management page.',
      );
    }
  }

  requireHost(request: Request): void {
    const session = this.getSession(request);
    if (!session?.authenticated)
      throw new UnauthorizedException('Host login required');
    this.checkCsrf(request, session);
  }

  private rateLimit(request: Request, response: Response): void {
    this.prune();
    // Never trust client-supplied X-Forwarded-For. Proxy-aware limiting must be
    // configured explicitly at deployment; otherwise proxy clients share a limit.
    const ip = request.socket.remoteAddress ?? 'unknown';
    let attempts = this.attempts.get(ip);
    if (!attempts) {
      if (this.attempts.size >= 1000)
        throw new HttpException('Too many login attempts', 429);
      attempts = { count: 0, expiresAt: Date.now() + attemptWindow };
      this.attempts.set(ip, attempts);
    }
    if (attempts.count >= 5 || this.activeVerifications >= 2) {
      response.setHeader(
        'Retry-After',
        String(
          Math.max(1, Math.ceil((attempts.expiresAt - Date.now()) / 1000)),
        ),
      );
      throw new HttpException(
        'Too many login attempts. Please try again later.',
        429,
      );
    }
    attempts.count++;
  }

  async login(request: Request, response: Response, password: string) {
    response.setHeader('Cache-Control', 'no-store');
    this.rateLimit(request, response);
    const session = this.getSession(request);
    if (!session)
      throw new ForbiddenException(
        'Refresh the management page before signing in',
      );
    this.checkCsrf(request, session);
    const hash = process.env.HOST_PASSWORD_HASH ?? '';
    if (!isPasswordHash(hash))
      throw new ServiceUnavailableException('Host access is not configured');
    this.activeVerifications++;
    let valid: boolean;
    try {
      valid = await verifyHostPassword(password, hash);
    } finally {
      this.activeVerifications--;
    }
    if (!valid) throw new UnauthorizedException('Incorrect host password');
    // Rotation prevents fixation and invalidates the pre-login CSRF token.
    this.sessions.delete(this.sessionId(request)!);
    return this.publicSession(this.issueSession(response, true));
  }

  logout(request: Request, response: Response) {
    this.requireHost(request);
    this.sessions.delete(this.sessionId(request)!);
    response.clearCookie(this.cookieName, this.cookieOptions);
    response.setHeader('Cache-Control', 'no-store');
    return { authenticated: false };
  }
}
