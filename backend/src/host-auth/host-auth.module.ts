import { Module } from '@nestjs/common';
import { HostAuthController } from './host-auth.controller.js';
import { HostAuthService } from './host-auth.service.js';
import { HostAuthGuard } from './host-auth.guard.js';

@Module({
  controllers: [HostAuthController],
  providers: [HostAuthService, HostAuthGuard],
  exports: [HostAuthGuard, HostAuthService],
})
export class HostAuthModule {}
