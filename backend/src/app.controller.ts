import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { ThrottleScope } from './common/throttling/throttle-scope.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Same exposure as the /logs simulators: every call raises an exception that
   * the Sentry filter reports. Left anonymous it is a free quota-burner and a
   * way to bury real errors under synthetic noise, so it gets the same gate.
   */
  @Get('/debug-sentry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('admin')
  @ThrottleScope('logs')
  getError() {
    throw new Error('My first Sentry error!');
  }
}
