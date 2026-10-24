import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Slot } from '../src/database/entities/slot.entity.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const database = { query: vi.fn(), isInitialized: false };

  beforeEach(async () => {
    database.query.mockReset().mockResolvedValue([{ '?column?': 1 }]);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(database)
      .overrideProvider(getRepositoryToken(Slot))
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/health (GET) reports API process health', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', service: 'Unblock API' });
  });

  it('/api/health/database (GET) checks the database', async () => {
    await request(app.getHttpServer())
      .get('/api/health/database')
      .expect(200)
      .expect({ status: 'ok', database: 'connected' });
    expect(database.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('/api/health/database (GET) hides database errors', async () => {
    database.query.mockRejectedValueOnce(new Error('Sensitive connection details'));
    await request(app.getHttpServer())
      .get('/api/health/database')
      .expect(503)
      .expect({
        statusCode: 503,
        message: 'Database is unavailable',
        error: 'Service Unavailable',
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
