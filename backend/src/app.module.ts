import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { SlotsModule } from './slots/slots.module.js';

@Module({
  imports: [DatabaseModule, SlotsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
