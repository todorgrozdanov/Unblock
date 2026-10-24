import { validateProductionEnvironment } from './production.js';
import { hashHostPassword } from './host-auth/password.js';
import {
  createDatabaseOptions,
  loadBackendEnvironment,
} from './database/database.config.js';

describe('Production configuration (no database)', () => {
  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FRONTEND_ORIGIN', 'https://unblock.example');
    vi.stubEnv('DB_HOST', 'test.neon.tech');
    vi.stubEnv('DB_PORT', '5432');
    vi.stubEnv('DB_NAME', 'unblock');
    vi.stubEnv('DB_USER', 'unblock_app');
    vi.stubEnv('DB_PASSWORD', 'synthetic-test-password');
    vi.stubEnv('DB_SSL', 'true');
    vi.stubEnv(
      'HOST_PASSWORD_HASH',
      await hashHostPassword('synthetic-host-password'),
    );
    vi.stubEnv('SESSION_SECRET', 'a'.repeat(64));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('requires verified TLS and keeps schema changes explicit', () => {
    expect(() => validateProductionEnvironment()).not.toThrow();
    const options = createDatabaseOptions();
    expect(options).toMatchObject({
      ssl: { rejectUnauthorized: true },
      synchronize: false,
      migrationsRun: false,
    });
  });
  it.each([
    ['DB_SSL', 'false'],
    ['DB_PASSWORD', ''],
    ['DB_PORT', 'invalid'],
    ['FRONTEND_ORIGIN', 'http://unblock.example'],
    ['FRONTEND_ORIGIN', 'https://unblock.example/'],
    ['HOST_PASSWORD_HASH', 'invalid'],
    ['SESSION_SECRET', ''],
  ])('rejects unsafe/incomplete production setting %s', (name, value) => {
    vi.stubEnv(name, value);
    expect(() => validateProductionEnvironment()).toThrow();
  });
  it('also rejects insecure standalone migration connections', () => {
    vi.stubEnv('DB_SSL', 'false');
    expect(() => createDatabaseOptions()).toThrow('verified TLS');
  });
  it('never loads local environment files in production', () => {
    const load = vi.spyOn(process, 'loadEnvFile');
    loadBackendEnvironment();
    expect(load).not.toHaveBeenCalled();
  });
});
