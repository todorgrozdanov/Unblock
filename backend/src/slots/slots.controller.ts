import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateSlotDto } from './create-slot.dto.js';
import { SlotsService } from './slots.service.js';

@Controller('api/slots')
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Post()
  create(@Body() input: CreateSlotDto) {
    return this.slots.create(input);
  }

  @Get()
  findAvailable() {
    return this.slots.findAvailable();
  }
}
