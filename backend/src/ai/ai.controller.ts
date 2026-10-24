import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { HostAuthGuard } from '../host-auth/host-auth.guard.js';
import { AiService } from './ai.service.js';
import { AiRateLimitGuard } from './ai-rate-limit.guard.js';
import { BookingConfirmationDto } from './booking-confirmation.dto.js';

@Controller('api/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('booking-confirmation')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(HostAuthGuard, AiRateLimitGuard)
  generate(@Body() input: BookingConfirmationDto) {
    return this.ai.generateForBooking(input.bookingId);
  }
}
