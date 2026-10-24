import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../database/entities/booking.entity.js';
import { Slot } from '../database/entities/slot.entity.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Slot])],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
