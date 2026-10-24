import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Slot } from '../src/database/entities/slot.entity.js';
import { SlotsModule } from '../src/slots/slots.module.js';
import { createValidationPipe } from '../src/validation.js';
import { HostAuthGuard } from '../src/host-auth/host-auth.guard.js';

describe('Slots HTTP API (mocked repository)', () => {
  let app: INestApplication;
  const repository = {
    create: vi.fn(),
    save: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
  const future = () => new Date(Date.now() + 86_400_000).toISOString();

  beforeEach(async () => {
    vi.clearAllMocks();
    repository.create.mockImplementation((input) => input);
    repository.save.mockImplementation(async (input) => ({
      id: 'a3daa197-052c-4cec-a753-241ae1dfc72c',
      ...input,
      createdAt: new Date(),
    }));
    const module = await Test.createTestingModule({ imports: [SlotsModule] })
      .overrideGuard(HostAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(getRepositoryToken(Slot))
      .useValue(repository)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([1, 480])(
    'creates a future slot with duration %i',
    async (durationMinutes) => {
      const startsAt = future();
      const response = await request(app.getHttpServer())
        .post('/api/slots')
        .send({ startsAt, durationMinutes })
        .expect(201);
      expect(response.body).toMatchObject({ startsAt, durationMinutes });
      expect(repository.save).toHaveBeenCalledOnce();
    },
  );

  it('accepts an explicit numeric timezone offset', async () => {
    const startsAt = `${future().slice(0, -1)}+00:00`;
    await request(app.getHttpServer())
      .post('/api/slots')
      .send({ startsAt, durationMinutes: 30 })
      .expect(201);
  });

  it.each([
    'not-a-date',
    '2099-02-30T10:00:00Z',
    '2099-01-01',
    '2099-01-01T10:00:00',
    '2099-01-01T25:00:00Z',
    '2020-01-01T10:00:00Z',
  ])(
    'rejects invalid, timezone-free, or past startsAt: %s',
    async (startsAt) => {
      await request(app.getHttpServer())
        .post('/api/slots')
        .send({ startsAt, durationMinutes: 30 })
        .expect(400);
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it.each([0, -1, 481, 1.5, '30', null])(
    'rejects duration %s',
    async (durationMinutes) => {
      await request(app.getHttpServer())
        .post('/api/slots')
        .send({ startsAt: future(), durationMinutes })
        .expect(400);
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it.each([{}, { durationMinutes: 30 }, { startsAt: '2099-01-01T10:00:00Z' }])(
    'rejects missing required fields',
    async (body) => {
      await request(app.getHttpServer())
        .post('/api/slots')
        .send(body)
        .expect(400);
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it('rejects unexpected properties', async () => {
    await request(app.getHttpServer())
      .post('/api/slots')
      .send({ startsAt: future(), durationMinutes: 30, isBooked: true })
      .expect(400);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('returns an empty list when no slots are available', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    repository.createQueryBuilder.mockReturnValue(query);
    await request(app.getHttpServer()).get('/api/slots').expect(200).expect([]);
  });
});
