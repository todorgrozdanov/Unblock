import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module.js';

async function bootstrap() {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
