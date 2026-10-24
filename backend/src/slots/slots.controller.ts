import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { HostAuthGuard } from '../host-auth/host-auth.guard.js';
import { CreateSlotDto } from './create-slot.dto.js';
import { SlotsService } from './slots.service.js';

@Controller('api/slots')
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Post()
  @UseGuards(HostAuthGuard)
  create(@Body() input: CreateSlotDto) {
    return this.slots.create(input);
  }

  @Get()
  findAvailable() {
    return this.slots.findAvailable();
  }
}
