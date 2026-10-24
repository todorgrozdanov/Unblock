import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
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
    try {
      // The database constraint handles overlaps, including concurrent inserts.
      return await this.slots.save(slot);
    } catch (error) {
      const driverError = error instanceof QueryFailedError
        ? error.driverError as { code?: string; constraint?: string }
        : undefined;
      if (driverError?.code === '23P01' && driverError.constraint === 'EX_slots_no_overlap') {
        throw new ConflictException(
          'That time overlaps an existing slot. Choose another start time or duration.',
        );
      }
      throw new InternalServerErrorException('Unable to create slot');
    }
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
