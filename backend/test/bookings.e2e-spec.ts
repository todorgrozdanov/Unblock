import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import request from 'supertest';
import { Booking } from '../src/database/entities/booking.entity.js';
import { Slot } from '../src/database/entities/slot.entity.js';
import { BookingsModule } from '../src/bookings/bookings.module.js';
import { createValidationPipe } from '../src/validation.js';

describe('Bookings HTTP API (mocked repositories)', () => {
  let app: INestApplication;
  const slotId = 'c051385a-1f8f-4446-a309-73b583ae6a59';
  const bookingId = '9929d371-b9a3-4d9d-b8d6-43feb620f6a4';
  const input = { slotId, name: '  Test Attendee  ', email: 'test@example.invalid' };
  const slots = { findOneBy: vi.fn() };
  const bookings = { existsBy: vi.fn(), create: vi.fn(), save: vi.fn() };
  let slot: { id: string; startsAt: Date; durationMinutes: number };

  beforeEach(async () => {
    vi.resetAllMocks();
    slot = { id: slotId, startsAt: new Date(Date.now() + 86_400_000), durationMinutes: 30 };
    slots.findOneBy.mockResolvedValue(slot);
    bookings.existsBy.mockResolvedValue(false);
    bookings.create.mockImplementation((value) => value);
    bookings.save.mockImplementation(async (value) => ({ id: bookingId, ...value }));
    const module = await Test.createTestingModule({ imports: [BookingsModule] })
      .overrideProvider(getRepositoryToken(Slot)).useValue(slots)
      .overrideProvider(getRepositoryToken(Booking)).useValue(bookings).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.useLogger(false);
    await app.init();
  });

  afterEach(async () => { await app.close(); });

  it('returns an explicit confirmation with a trimmed name and slot details', async () => {
    const response = await request(app.getHttpServer()).post('/api/bookings')
      .send({ ...input, taskDescription: 'Automate a report' }).expect(201);
    expect(response.body).toEqual({
      id: bookingId, name: 'Test Attendee', email: input.email,
      taskDescription: 'Automate a report',
      slot: { id: slotId, startsAt: slot.startsAt.toISOString(), durationMinutes: 30 },
    });
    expect(slots.findOneBy).toHaveBeenCalledWith({ id: slotId });
    expect(bookings.save).toHaveBeenCalledOnce();
  });

  it('accepts an omitted task description', async () => {
    const response = await request(app.getHttpServer()).post('/api/bookings').send(input).expect(201);
    expect(response.body.taskDescription).toBeNull();
  });

  it('accepts maximum name and description lengths', async () => {
    await request(app.getHttpServer()).post('/api/bookings')
      .send({ ...input, name: 'a'.repeat(100), taskDescription: 'b'.repeat(2000) }).expect(201);
  });

  it.each([
    { slotId: 'invalid' }, { slotId: null }, { name: '   ' }, { name: 123 },
    { name: 'x'.repeat(101) }, { email: 'not-an-email' }, { email: null },
    { email: 'a'.repeat(243) + '@example.com' },
    { taskDescription: 123 }, { taskDescription: null },
    { taskDescription: 'x'.repeat(2001) }, { unexpected: true },
  ])('rejects invalid input %# before querying the database', async (invalid) => {
    await request(app.getHttpServer()).post('/api/bookings')
      .send({ ...input, ...invalid }).expect(400);
    expect(slots.findOneBy).not.toHaveBeenCalled();
    expect(bookings.save).not.toHaveBeenCalled();
  });

  it.each(['slotId', 'name', 'email'])('requires %s', async (field) => {
    const body: Record<string, unknown> = { ...input };
    delete body[field];
    await request(app.getHttpServer()).post('/api/bookings').send(body).expect(400);
    expect(bookings.save).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing slot', async () => {
    slots.findOneBy.mockResolvedValue(null);
    await request(app.getHttpServer()).post('/api/bookings').send(input).expect(404);
    expect(bookings.save).not.toHaveBeenCalled();
  });

  it('returns 409 for a slot that has started', async () => {
    slots.findOneBy.mockResolvedValue({ ...slot, startsAt: new Date(Date.now() - 1000) });
    await request(app.getHttpServer()).post('/api/bookings').send(input).expect(409);
    expect(bookings.save).not.toHaveBeenCalled();
  });

  it('returns 409 for an already booked slot', async () => {
    bookings.existsBy.mockResolvedValue(true);
    await request(app.getHttpServer()).post('/api/bookings').send(input).expect(409);
    expect(bookings.save).not.toHaveBeenCalled();
  });

  function databaseError(constraint: string, code = '23505') {
    const driverError = Object.assign(new Error('Internal details must remain private'), { code, constraint });
    return new QueryFailedError('SQL must remain private', [], driverError);
  }

  it('handles the slot UNIQUE violation even when the precheck found no booking', async () => {
    bookings.save.mockRejectedValue(databaseError('UQ_bookings_slotId'));
    const response = await request(app.getHttpServer()).post('/api/bookings').send(input).expect(409);
    expect(response.body).toEqual({
      statusCode: 409, error: 'Conflict',
      message: 'This slot is already booked. Please choose another slot.',
    });
  });

  it.each([['PK_bookings', '23505'], ['FK_bookings_slotId', '23503']])(
    'does not misclassify other database errors: %s', async (constraint, code) => {
      bookings.save.mockRejectedValue(databaseError(constraint, code));
      const response = await request(app.getHttpServer()).post('/api/bookings').send(input).expect(500);
      expect(response.body).toEqual({ statusCode: 500, error: 'Internal Server Error', message: 'Unable to create booking' });
    },
  );

  it('does not expose a public booking-list route', async () => {
    await request(app.getHttpServer()).get('/api/bookings').expect(404);
  });
});
