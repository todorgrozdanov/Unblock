import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Slot } from '../src/database/entities/slot.entity.js';
import { Booking } from '../src/database/entities/booking.entity.js';
import { configureHttp } from '../src/production.js';
import { hashHostPassword } from '../src/host-auth/password.js';

describe('Single-origin production HTTP (database mocked)', () => {
  let app: NestExpressApplication;
  let directory: string;
  const origin = 'https://unblock.example';
  const password = 'Synthetic production password!';
  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DB_SSL', 'true');
    vi.stubEnv('SERVE_FRONTEND', 'true');
    vi.stubEnv('FRONTEND_ORIGIN', origin);
    vi.stubEnv('SESSION_SECRET', 'b'.repeat(64));
    vi.stubEnv('HOST_PASSWORD_HASH', await hashHostPassword(password));
    directory = mkdtempSync(join(tmpdir(), 'unblock-production-test-'));
    mkdirSync(join(directory, 'assets'));
    writeFileSync(
      join(directory, 'index.html'),
      '<!doctype html><title>Unblock production</title>',
    );
    writeFileSync(
      join(directory, 'assets', 'app.js'),
      'console.log("synthetic asset")',
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue({ query: async () => [{ result: 1 }], isInitialized: false })
      .overrideProvider(getRepositoryToken(Slot))
      .useValue({})
      .overrideProvider(getRepositoryToken(Booking))
      .useValue({})
      .compile();
    app = module.createNestApplication<NestExpressApplication>();
    app.useLogger(false);
    configureHttp(app, directory);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    if (directory?.startsWith(join(tmpdir(), 'unblock-production-test-')))
      rmSync(directory, { recursive: true });
    vi.unstubAllEnvs();
  });
  it.each(['/', '/host', '/host/'])('serves the SPA at %s', async (path) => {
    const response = await request(app.getHttpServer())
      .get(path)
      .expect(200)
      .expect('Content-Type', /html/);
    expect(response.text).toContain('Unblock production');
    expect(response.headers['cache-control']).toBe('no-cache');
  });
  it('serves hashed assets with caching', async () => {
    const response = await request(app.getHttpServer())
      .get('/assets/app.js')
      .expect(200);
    expect(response.headers['cache-control']).toContain('immutable');
  });
  it.each([
    '/api/not-found',
    '/assets/missing.js',
    '/.env',
    '/backend/.env',
    '/src/main.ts',
    '/not-a-ui-route',
  ])('keeps %s a 404 instead of returning the SPA', async (path) => {
    const response = await request(app.getHttpServer()).get(path).expect(404);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.text).not.toContain('<!doctype html>');
  });
  it('preserves API health and database health JSON', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', service: 'Unblock API' });
    await request(app.getHttpServer())
      .get('/api/health/database')
      .expect(200)
      .expect({ status: 'ok', database: 'connected' });
    await request(app.getHttpServer()).post('/api/slots').send({}).expect(401);
  });
  it('allows only the configured credentialed CORS origin', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', origin)
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(origin);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const other = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'https://other.example');
    expect(other.headers['access-control-allow-origin']).not.toBe(
      'https://other.example',
    );
  });
  it('signs Secure host cookies and verifies production login/logout and tampering', async () => {
    const anonymous = await request(app.getHttpServer())
      .get('/api/host/session')
      .expect(200);
    const cookie = anonymous.headers['set-cookie'][0].split(';')[0];
    expect(cookie).toMatch(/^__Host-unblock_host=[a-f0-9]{64}\.[a-f0-9]{64}$/);
    expect(anonymous.headers['set-cookie'][0]).toContain('Secure');
    const login = await request(app.getHttpServer())
      .post('/api/host/login')
      .set('Cookie', cookie)
      .set('Origin', origin)
      .set('X-CSRF-Token', anonymous.body.csrfToken)
      .send({ password })
      .expect(200);
    const hostCookie = login.headers['set-cookie'][0].split(';')[0];
    expect(login.body.authenticated).toBe(true);
    const tampered =
      hostCookie.slice(0, -1) + (hostCookie.endsWith('0') ? '1' : '0');
    const denied = await request(app.getHttpServer())
      .get('/api/host/session')
      .set('Cookie', tampered)
      .expect(200);
    expect(denied.body.authenticated).toBe(false);
    const persisted = await request(app.getHttpServer())
      .get('/api/host/session')
      .set('Cookie', hostCookie)
      .expect(200);
    expect(persisted.body.authenticated).toBe(true);
    await request(app.getHttpServer())
      .post('/api/host/logout')
      .set('Cookie', hostCookie)
      .set('Origin', origin)
      .set('X-CSRF-Token', login.body.csrfToken)
      .expect(200);
    const after = await request(app.getHttpServer())
      .get('/api/host/session')
      .set('Cookie', hostCookie)
      .expect(200);
    expect(after.body.authenticated).toBe(false);
  });
});
