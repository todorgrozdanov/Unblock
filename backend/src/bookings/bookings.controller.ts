import { Body, Controller, Post } from '@nestjs/common';
import { CreateBookingDto } from './create-booking.dto.js';
import { BookingsService } from './bookings.service.js';

@Controller('api/bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  create(@Body() input: CreateBookingDto) {
    return this.bookings.create(input);
  }
}
