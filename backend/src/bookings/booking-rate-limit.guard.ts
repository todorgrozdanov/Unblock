import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RateLimitService } from '../rate-limit/rate-limit.service.js';

@Injectable()
export class BookingRateLimitGuard implements CanActivate {
  constructor(private readonly limits: RateLimitService) {}
  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    this.limits.check(
      'booking',
      http.getRequest(),
      http.getResponse(),
      10,
      15 * 60_000,
    );
    return true;
  }
}
