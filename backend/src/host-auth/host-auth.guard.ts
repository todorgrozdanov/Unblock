import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { HostAuthService } from './host-auth.service.js';

@Injectable()
export class HostAuthGuard implements CanActivate {
  constructor(private readonly auth: HostAuthService) {}
  canActivate(context: ExecutionContext): boolean {
    this.auth.requireHost(context.switchToHttp().getRequest());
    return true;
  }
}
