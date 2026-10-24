import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { loadBackendEnvironment } from './database/database.config.js';
import { configureHttp, validateProductionEnvironment } from './production.js';

async function bootstrap() {
  loadBackendEnvironment();
  validateProductionEnvironment();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureHttp(app);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
await bootstrap();
