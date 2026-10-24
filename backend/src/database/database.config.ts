import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DataSourceOptions } from 'typeorm';
import { Booking } from './entities/booking.entity.js';
import { Slot } from './entities/slot.entity.js';
import { InitialSlotsAndBookings1792800000000 } from './migrations/1792800000000-InitialSlotsAndBookings.js';
import { PreventOverlappingSlots1792890000000 } from './migrations/1792890000000-PreventOverlappingSlots.js';

export function loadBackendEnvironment(): void {
  // Hosted settings must never fall back to a developer's local credentials.
  if (process.env.NODE_ENV === 'production') return;
  const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}

export function createDatabaseOptions(): DataSourceOptions {
  loadBackendEnvironment();
  if (process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'true')
    throw new Error('Production database connections require verified TLS');
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'unblock',
    username: process.env.DB_USER ?? 'unblock_app',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
    poolSize: 3,
    extra: { idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000 },
    schema: 'public',
    entities: [Slot, Booking],
    migrations: [InitialSlotsAndBookings1792800000000, PreventOverlappingSlots1792890000000],
    migrationsTableName: 'migrations',
    synchronize: false,
    migrationsRun: false,
    // PostgreSQL 18 supplies gen_random_uuid(); no extension is installed.
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    logging: false,
  };
}
