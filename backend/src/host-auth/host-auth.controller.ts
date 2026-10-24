import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { HostAuthService } from './host-auth.service.js';
import { LoginDto } from './login.dto.js';

@Controller('api/host')
export class HostAuthController {
  constructor(private readonly auth: HostAuthService) {}

  @Get('session')
  session(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.session(request, response);
  }

  @Post('login')
  @HttpCode(200)
  login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() input: LoginDto,
  ) {
    return this.auth.login(request, response, input.password);
  }

  @Post('logout')
  @HttpCode(200)
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.logout(request, response);
  }
}
