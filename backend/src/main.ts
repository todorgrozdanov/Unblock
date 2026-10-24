import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadBackendEnvironment } from './database/database.config.js';
import { createValidationPipe } from './validation.js';

async function bootstrap() {
  loadBackendEnvironment();

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(createValidationPipe());
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
