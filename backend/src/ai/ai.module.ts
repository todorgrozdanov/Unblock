import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../database/entities/booking.entity.js';
import { HostAuthModule } from '../host-auth/host-auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { AiRateLimitGuard } from './ai-rate-limit.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking]),
    HostAuthModule,
    RateLimitModule,
  ],
  controllers: [AiController],
  providers: [AiService, AiRateLimitGuard],
  exports: [AiService],
})
export class AiModule {}
