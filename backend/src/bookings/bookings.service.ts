import {
  ConflictException, Injectable, InternalServerErrorException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Booking } from '../database/entities/booking.entity.js';
import { Slot } from '../database/entities/slot.entity.js';
import type { CreateBookingDto } from './create-booking.dto.js';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Slot) private readonly slots: Repository<Slot>,
  ) {}

  async create(input: CreateBookingDto) {
    const slot = await this.slots.findOneBy({ id: input.slotId });
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.startsAt.getTime() <= Date.now()) {
      throw new ConflictException('This slot has already started');
    }
    if (await this.bookings.existsBy({ slotId: slot.id })) {
      throw new ConflictException('This slot is already booked. Please choose another slot.');
    }

    const booking = this.bookings.create({
      slotId: slot.id,
      name: input.name,
      email: input.email,
      taskDescription: input.taskDescription ?? null,
    });
    let saved: Booking;
    try {
      saved = await this.bookings.save(booking);
    } catch (error) {
      // Both requests can pass existsBy. Only the database can arbitrate the race.
      const driverError = error instanceof QueryFailedError
        ? error.driverError as { code?: string; constraint?: string }
        : undefined;
      if (driverError?.code === '23505' && driverError.constraint === 'UQ_bookings_slotId') {
        throw new ConflictException('This slot is already booked. Please choose another slot.');
      }
      throw new InternalServerErrorException('Unable to create booking');
    }

    return {
      id: saved.id,
      name: saved.name,
      email: saved.email,
      taskDescription: saved.taskDescription,
      slot: {
        id: slot.id,
        startsAt: slot.startsAt,
        durationMinutes: slot.durationMinutes,
      },
    };
  }
}
