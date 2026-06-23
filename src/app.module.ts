import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from './config/env';
import { ChatGateway } from './gateways/chat.gateway';
import { WsJwtGuard } from './gateways/ws-jwt.guard';
import { HealthController } from './health/health.controller';

@Module({
  imports: [JwtModule.register({ secret: env.JWT_SECRET })],
  controllers: [HealthController],
  providers: [WsJwtGuard, ChatGateway],
})
export class AppModule {}
