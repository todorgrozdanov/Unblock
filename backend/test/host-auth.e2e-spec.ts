import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { SlotsModule } from '../src/slots/slots.module.js';
import { Slot } from '../src/database/entities/slot.entity.js';
import { hashHostPassword } from '../src/host-auth/password.js';
import { createValidationPipe } from '../src/validation.js';

const origin = 'http://localhost:5173';
const password = 'Only a test host password!';
const payload = () => ({
  startsAt: new Date(Date.now() + 86_400_000).toISOString(),
  durationMinutes: 30,
});

describe('Host sessions, CSRF, and slot authorization (no database)', () => {
  let app: INestApplication;
  let passwordHash: string;
  const slots = { create: vi.fn(), save: vi.fn(), createQueryBuilder: vi.fn() };

  beforeAll(async () => {
    passwordHash = await hashHostPassword(password);
  });
  beforeEach(async () => {
    vi.stubEnv('HOST_PASSWORD_HASH', passwordHash);
    vi.stubEnv('FRONTEND_ORIGIN', origin);
    vi.stubEnv('NODE_ENV', 'test');
    vi.resetAllMocks();
    slots.create.mockImplementation((value) => value);
    slots.save.mockImplementation(async (value) => ({
      id: 'test-slot',
      ...value,
    }));
    const query = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    slots.createQueryBuilder.mockReturnValue(query);
    const module = await Test.createTestingModule({ imports: [SlotsModule] })
      .overrideProvider(getRepositoryToken(Slot))
      .useValue(slots)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.useLogger(false);
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
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
    return { agent, anonymous, login };
  }

  it('keeps availability public and blocks unauthenticated slot creation', async () => {
    await request(app.getHttpServer()).get('/api/slots').expect(200).expect([]);
    await request(app.getHttpServer())
      .post('/api/slots')
      .send(payload())
      .expect(401);
    expect(slots.save).not.toHaveBeenCalled();
  });

  it('requires CSRF protection even for login', async () => {
    await request(app.getHttpServer())
      .post('/api/host/login')
      .set('Origin', origin)
      .send({ password })
      .expect(403);
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/host/session').set('Origin', origin);
    await agent
      .post('/api/host/login')
      .set('Origin', origin)
      .send({ password })
      .expect(403);
  });

  it('verifies the hash, rotates cookie/token, and permits protected creation', async () => {
    const { agent, anonymous, login } = await signIn();
    expect(login.body.authenticated).toBe(true);
    expect(login.body.csrfToken).not.toBe(anonymous.body.csrfToken);
    const cookie = login.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=3600');
    expect(cookie).toContain('Path=/');
    expect(cookie.split(';')[0]).not.toBe(
      anonymous.headers['set-cookie'][0].split(';')[0],
    );
    expect(login.headers['cache-control']).toBe('no-store');
    await agent
      .post('/api/slots')
      .set('Origin', origin)
      .set('X-CSRF-Token', login.body.csrfToken)
      .send(payload())
      .expect(201);
    expect(slots.save).toHaveBeenCalledOnce();
    await request(app.getHttpServer())
      .post('/api/slots')
      .set('Cookie', anonymous.headers['set-cookie'][0].split(';')[0])
      .set('Origin', origin)
      .set('X-CSRF-Token', anonymous.body.csrfToken)
      .send(payload())
      .expect(401);
  });

  it('does not accept incorrect passwords', async () => {
    const agent = request.agent(app.getHttpServer());
    const session = await agent.get('/api/host/session').set('Origin', origin);
    await agent
      .post('/api/host/login')
      .set('Origin', origin)
      .set('X-CSRF-Token', session.body.csrfToken)
      .send({ password: 'incorrect' })
      .expect(401);
    await agent
      .post('/api/slots')
      .set('Origin', origin)
      .set('X-CSRF-Token', session.body.csrfToken)
      .send(payload())
      .expect(401);
  });

  it('rejects cross-origin session bootstrap and login', async () => {
    await request(app.getHttpServer())
      .get('/api/host/session')
      .set('Origin', 'https://untrusted.example')
      .expect(403);
    const agent = request.agent(app.getHttpServer());
    const session = await agent.get('/api/host/session').set('Origin', origin);
    await agent
      .post('/api/host/login')
      .set('Origin', 'https://untrusted.example')
      .set('X-CSRF-Token', session.body.csrfToken)
      .send({ password })
      .expect(403);
  });

  it('rejects missing, wrong, old, or cross-origin CSRF tokens on host writes', async () => {
    const { agent, anonymous, login } = await signIn();
    for (const token of ['', 'wrong', anonymous.body.csrfToken]) {
      await agent
        .post('/api/slots')
        .set('Origin', origin)
        .set('X-CSRF-Token', token)
        .send(payload())
        .expect(403);
    }
    await agent
      .post('/api/slots')
      .set('Origin', 'https://untrusted.example')
      .set('X-CSRF-Token', login.body.csrfToken)
      .send(payload())
      .expect(403);
    await agent
      .post('/api/slots')
      .set('X-CSRF-Token', login.body.csrfToken)
      .send(payload())
      .expect(403);
    expect(slots.save).not.toHaveBeenCalled();
  });

  it('expires sessions on the server even when the cookie is replayed', async () => {
    const { login } = await signIn();
    const afterExpiry = Date.parse(login.body.expiresAt) + 1;
    vi.spyOn(Date, 'now').mockReturnValue(afterExpiry);
    await request(app.getHttpServer())
      .post('/api/slots')
      .set('Cookie', login.headers['set-cookie'][0].split(';')[0])
      .set('Origin', origin)
      .set('X-CSRF-Token', login.body.csrfToken)
      .send(payload())
      .expect(401);
  });

  it('requires CSRF for logout, destroys the session, and clears the cookie', async () => {
    const { agent, login } = await signIn();
    await agent.post('/api/host/logout').set('Origin', origin).expect(403);
    const logout = await agent
      .post('/api/host/logout')
      .set('Origin', origin)
      .set('X-CSRF-Token', login.body.csrfToken)
      .expect(200);
    expect(logout.headers['set-cookie'][0]).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
    await request(app.getHttpServer())
      .post('/api/slots')
      .set('Cookie', login.headers['set-cookie'][0].split(';')[0])
      .set('Origin', origin)
      .set('X-CSRF-Token', login.body.csrfToken)
      .send(payload())
      .expect(401);
  });

  it('limits login attempts by IP across sessions and ignores spoofed proxy headers', async () => {
    const agent = request.agent(app.getHttpServer());
    const session = await agent.get('/api/host/session').set('Origin', origin);
    for (let index = 0; index < 5; index++) {
      await agent
        .post('/api/host/login')
        .set('Origin', origin)
        .set('X-CSRF-Token', session.body.csrfToken)
        .set('X-Forwarded-For', `192.0.2.${index}`)
        .send({ password: 'incorrect' })
        .expect(401);
    }
    const limited = await request(app.getHttpServer())
      .post('/api/host/login')
      .set('Origin', origin)
      .set('X-CSRF-Token', session.body.csrfToken)
      .send({ password })
      .expect(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('fails closed for missing or malformed password configuration', async () => {
    const agent = request.agent(app.getHttpServer());
    const session = await agent.get('/api/host/session').set('Origin', origin);
    for (const hash of ['', 'not-a-hash']) {
      vi.stubEnv('HOST_PASSWORD_HASH', hash);
      await agent
        .post('/api/host/login')
        .set('Origin', origin)
        .set('X-CSRF-Token', session.body.csrfToken)
        .send({ password })
        .expect(503);
    }
    await agent
      .post('/api/slots')
      .set('Origin', origin)
      .send(payload())
      .expect(401);
  });

  it('sets production cookies Secure and host-only', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const session = await request(app.getHttpServer())
      .get('/api/host/session')
      .set('Origin', origin)
      .expect(200);
    const cookie = session.headers['set-cookie'][0];
    expect(cookie).toMatch(/^__Host-unblock_host=/);
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).not.toContain('Domain=');
  });

  it('rejects unexpected login fields', async () => {
    await request(app.getHttpServer())
      .post('/api/host/login')
      .send({ password, admin: true })
      .expect(400);
  });
});
