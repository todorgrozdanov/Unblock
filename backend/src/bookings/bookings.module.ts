import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../database/entities/booking.entity.js';
import { Slot } from '../database/entities/slot.entity.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { AiModule } from '../ai/ai.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { BookingRateLimitGuard } from './booking-rate-limit.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Slot]),
    AiModule,
    RateLimitModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingRateLimitGuard],
})
export class BookingsModule {}
