import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AiModule } from '../src/ai/ai.module.js';
import { fallbackConfirmation } from '../src/ai/ai.service.js';
import { Booking } from '../src/database/entities/booking.entity.js';
import { hashHostPassword } from '../src/host-auth/password.js';
import { createValidationPipe } from '../src/validation.js';
import { geminiMock } from './gemini.mock.js';

const origin = 'http://localhost:5173';
const password = 'Only a synthetic AI endpoint test!';
const bookingId = '9929d371-b9a3-4d9d-b8d6-43feb620f6a4';
const session = {
  startsAt: new Date('2027-01-15T09:30:00Z'),
  durationMinutes: 30,
};
const words = {
  welcome: 'Welcome to Unblock!',
  preparation:
    'Please bring one concrete example of a repetitive task to explore together.',
};

describe('Host-only AI endpoint (mocked Gemini and database)', () => {
  let app: INestApplication;
  let hash: string;
  const query = {
    innerJoin: vi.fn(),
    select: vi.fn(),
    addSelect: vi.fn(),
    where: vi.fn(),
    getRawOne: vi.fn(),
  };
  const bookings = { createQueryBuilder: vi.fn() };

  beforeAll(async () => {
    hash = await hashHostPassword(password);
  });
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubEnv('HOST_PASSWORD_HASH', hash);
    vi.stubEnv('FRONTEND_ORIGIN', origin);
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('GEMINI_API_KEY', 'synthetic-unit-test-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.5-flash-lite');
    for (const method of ['innerJoin', 'select', 'addSelect', 'where'] as const)
      query[method].mockReturnValue(query);
    query.getRawOne.mockResolvedValue(session);
    bookings.createQueryBuilder.mockReturnValue(query);
    geminiMock.generateContent.mockResolvedValue({
      text: JSON.stringify(words),
      candidates: [{ finishReason: 'STOP' }],
    });
    const module = await Test.createTestingModule({ imports: [AiModule] })
      .overrideProvider(getRepositoryToken(Booking))
      .useValue(bookings)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.useLogger(false);
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  async function signIn() {
    const agent = request.agent(app.getHttpServer());
    const anonymous = await agent
      .get('/api/host/session')
      .set('Origin', origin)
      .expect(200);
    const login = await agent
      .post('/api/host/login')
      .set('Origin', origin)
      .set('X-CSRF-Token', anonymous.body.csrfToken)
      .send({ password })
      .expect(200);
    return { agent, token: login.body.csrfToken };
  }

  it('rejects unauthenticated requests without looking up a booking or calling Gemini', async () => {
    await request(app.getHttpServer())
      .post('/api/ai/booking-confirmation')
      .send({ bookingId })
      .expect(401);
    expect(bookings.createQueryBuilder).not.toHaveBeenCalled();
    expect(geminiMock.generateContent).not.toHaveBeenCalled();
  });

  it('requires CSRF and the configured origin even for an authenticated host', async () => {
    const { agent, token } = await signIn();
    await agent
      .post('/api/ai/booking-confirmation')
      .set('Origin', origin)
      .send({ bookingId })
      .expect(403);
    await agent
      .post('/api/ai/booking-confirmation')
      .set('Origin', 'https://untrusted.example')
      .set('X-CSRF-Token', token)
      .send({ bookingId })
      .expect(403);
    expect(geminiMock.generateContent).not.toHaveBeenCalled();
  });

  it.each([
    { bookingId: 'bad' },
    {},
    { bookingId, prompt: 'Arbitrary prompt' },
  ])(
    'validates UUID and rejects arbitrary prompt fields: %j',
    async (input) => {
      const { agent, token } = await signIn();
      await agent
        .post('/api/ai/booking-confirmation')
        .set('Origin', origin)
        .set('X-CSRF-Token', token)
        .send(input)
        .expect(400);
      expect(bookings.createQueryBuilder).not.toHaveBeenCalled();
      expect(geminiMock.generateContent).not.toHaveBeenCalled();
    },
  );

  it('loads only session timing and returns message fields with no attendee data', async () => {
    const { agent, token } = await signIn();
    const response = await agent
      .post('/api/ai/booking-confirmation')
      .set('Origin', origin)
      .set('X-CSRF-Token', token)
      .send({ bookingId })
      .expect(200);
    expect(response.body.confirmationMessageSource).toBe('ai');
    expect(Object.keys(response.body).sort()).toEqual([
      'confirmationMessage',
      'confirmationMessageSource',
    ]);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(query.select).toHaveBeenCalledWith('slot.startsAt', 'startsAt');
    expect(query.addSelect).toHaveBeenCalledWith(
      'slot.durationMinutes',
      'durationMinutes',
    );
    expect(query.where).toHaveBeenCalledWith('booking.id = :bookingId', {
      bookingId,
    });
    expect(geminiMock.generateContent.mock.calls[0][0].contents).not.toContain(
      bookingId,
    );
  });

  it('returns 404 for a missing booking without generating', async () => {
    query.getRawOne.mockResolvedValue(undefined);
    const { agent, token } = await signIn();
    await agent
      .post('/api/ai/booking-confirmation')
      .set('Origin', origin)
      .set('X-CSRF-Token', token)
      .send({ bookingId })
      .expect(404);
    expect(geminiMock.generateContent).not.toHaveBeenCalled();
  });

  it('returns fallback when provider generation fails', async () => {
    geminiMock.generateContent.mockRejectedValue(
      new Error('Private provider error'),
    );
    const { agent, token } = await signIn();
    const response = await agent
      .post('/api/ai/booking-confirmation')
      .set('Origin', origin)
      .set('X-CSRF-Token', token)
      .send({ bookingId })
      .expect(200);
    expect(response.body).toEqual(fallbackConfirmation());
  });

  it('limits the host generation endpoint per socket IP, ignoring spoofed proxy headers', async () => {
    const { agent, token } = await signIn();
    for (let i = 0; i < 5; i++) {
      await agent
        .post('/api/ai/booking-confirmation')
        .set('Origin', origin)
        .set('X-Forwarded-For', `192.0.2.${i}`)
        .set('X-CSRF-Token', token)
        .send({ bookingId })
        .expect(200);
    }
    const limited = await agent
      .post('/api/ai/booking-confirmation')
      .set('Origin', origin)
      .set('X-CSRF-Token', token)
      .send({ bookingId })
      .expect(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(geminiMock.generateContent).toHaveBeenCalledTimes(5);
  });
});
