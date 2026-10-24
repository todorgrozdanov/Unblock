import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { BookingRateLimitGuard } from './booking-rate-limit.guard.js';
import { CreateBookingDto } from './create-booking.dto.js';
import { BookingsService } from './bookings.service.js';

@Controller('api/bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @UseGuards(BookingRateLimitGuard)
  create(@Body() input: CreateBookingDto) {
    return this.bookings.create(input);
  }
}
