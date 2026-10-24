import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NextFunction, Request, Response } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { isPasswordHash } from './host-auth/password.js';
import { createValidationPipe } from './validation.js';

export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  if (required.some((name) => !process.env[name]?.trim()))
    throw new Error('Production database configuration is incomplete');
  const port = Number(process.env.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('DB_PORT must be a valid TCP port');
  if (process.env.DB_SSL !== 'true')
    throw new Error('Production requires verified database TLS (DB_SSL=true)');
  const origin = process.env.FRONTEND_ORIGIN ?? '';
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin) throw new Error();
  } catch {
    throw new Error('FRONTEND_ORIGIN must be an exact HTTPS origin');
  }
  if (!isPasswordHash(process.env.HOST_PASSWORD_HASH ?? ''))
    throw new Error('Production requires a valid HOST_PASSWORD_HASH');
  if (!/^[a-f0-9]{64}$/.test(process.env.SESSION_SECRET ?? ''))
    throw new Error(
      'Production requires a random 64-hex-character SESSION_SECRET',
    );
}

export function configureHttp(
  app: NestExpressApplication,
  frontendPath = fileURLToPath(
    new URL('../../frontend/dist/', import.meta.url),
  ),
): void {
  // Keep proxy trust off until the actual proxy chain has been verified. Cookies
  // use an explicit Secure flag and CSRF checks use the configured exact origin.
  app.set('trust proxy', false);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.useGlobalPipes(createValidationPipe());
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.path === '/api' || req.path.startsWith('/api/'))
      res.setHeader('Cache-Control', 'no-store');
    next();
  });
  if (process.env.SERVE_FRONTEND !== 'true') return;
  if (!existsSync(`${frontendPath}/index.html`))
    throw new Error('Frontend build is missing; run the root production build');
  // Restrict static files to /assets. Never expose .env, source, or backend files.
  app.useStaticAssets(`${frontendPath}/assets`, {
    prefix: '/assets/',
    index: false,
    dotfiles: 'deny',
    maxAge: '1y',
    immutable: true,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Only actual UI routes receive the SPA. Unknown API routes/assets keep 404s.
    if (
      (req.method === 'GET' || req.method === 'HEAD') &&
      ['/', '/host', '/host/'].includes(req.path)
    ) {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(`${frontendPath}/index.html`);
      return;
    }
    next();
  });
}
