import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RateLimitService } from '../rate-limit/rate-limit.service.js';

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  constructor(private readonly limits: RateLimitService) {}
  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    this.limits.check(
      'host-ai',
      http.getRequest(),
      http.getResponse(),
      5,
      60_000,
    );
    return true;
  }
}
