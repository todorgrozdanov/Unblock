import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/health')
  getHealth() {
    return { status: 'ok', service: 'Unblock API' };
  }

  @Get('api/health/database')
  async getDatabaseHealth() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }
  }
}
