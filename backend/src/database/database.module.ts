import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME ?? 'unblock',
        username: process.env.DB_USER ?? 'unblock_app',
        password: process.env.DB_PASSWORD,
        entities: [],
        synchronize: false,
        migrationsRun: false,
        logging: false,
        verboseRetryLog: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
