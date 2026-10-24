import { HttpException, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

interface Counter {
  count: number;
  expiresAt: number;
}

// Same bounded, in-memory socket-IP approach as host login. No forwarded-header trust.
@Injectable()
export class RateLimitService {
  private readonly counters = new Map<string, Counter>();

  check(
    bucket: string,
    request: Request,
    response: Response,
    limit: number,
    windowMs: number,
  ): void {
    const now = Date.now();
    for (const [key, counter] of this.counters)
      if (counter.expiresAt <= now) this.counters.delete(key);
    const key = `${bucket}:${request.socket.remoteAddress ?? 'unknown'}`;
    let counter = this.counters.get(key);
    if (!counter) {
      if (this.counters.size >= 1000)
        this.reject(response, Math.ceil(windowMs / 1000));
      counter = { count: 0, expiresAt: now + windowMs };
      this.counters.set(key, counter);
    }
    if (counter.count >= limit)
      this.reject(
        response,
        Math.max(1, Math.ceil((counter.expiresAt - now) / 1000)),
      );
    counter.count++;
  }

  private reject(response: Response, seconds: number): never {
    response.setHeader('Retry-After', String(seconds));
    throw new HttpException('Too many requests. Please try again later.', 429);
  }
}
