import { Controller, Get } from '@nestjs/common';
import { env } from '../config/env';

@Controller()
export class HealthController {
  @Get('/health')
  health() {
    return {
      status: 'ok',
      service: 'rorr-socket-server',
      runtime: env.RUNTIME,
      uptime: process.uptime(),
      ts: Date.now(),
    };
  }
}
