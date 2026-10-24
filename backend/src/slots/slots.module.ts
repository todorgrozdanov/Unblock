import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Slot } from '../database/entities/slot.entity.js';
import { SlotsController } from './slots.controller.js';
import { SlotsService } from './slots.service.js';
import { HostAuthModule } from '../host-auth/host-auth.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Slot]), HostAuthModule],
  controllers: [SlotsController],
  providers: [SlotsService],
})
export class SlotsModule {}
