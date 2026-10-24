import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slot } from '../database/entities/slot.entity.js';
import { Booking } from '../database/entities/booking.entity.js';
import type { CreateSlotDto } from './create-slot.dto.js';

@Injectable()
export class SlotsService {
  constructor(@InjectRepository(Slot) private readonly slots: Repository<Slot>) {}

  async create(input: CreateSlotDto): Promise<Slot> {
    const startsAt = new Date(input.startsAt);
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('startsAt must be in the future');
    }
    const slot = this.slots.create({ startsAt, durationMinutes: input.durationMinutes });
    return this.slots.save(slot);
  }

  findAvailable(): Promise<Slot[]> {
    return this.slots.createQueryBuilder('slot')
      .select(['slot.id', 'slot.startsAt', 'slot.durationMinutes', 'slot.createdAt'])
      .where('slot.startsAt > :now', { now: new Date() })
      .andWhere((query) => {
        const booking = query.subQuery()
          .select('1')
          .from(Booking, 'booking')
          .where('booking.slotId = slot.id')
          .getQuery();
        return `NOT EXISTS ${booking}`;
      })
      .orderBy('slot.startsAt', 'ASC')
      .getMany();
  }
}
