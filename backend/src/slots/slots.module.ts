import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Slot } from '../database/entities/slot.entity.js';
import { SlotsController } from './slots.controller.js';
import { SlotsService } from './slots.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Slot])],
  controllers: [SlotsController],
  providers: [SlotsService],
})
export class SlotsModule {}
