import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from './config/env';
import { ChatGateway } from './gateways/chat.gateway';
import { WsJwtGuard } from './gateways/ws-jwt.guard';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { RoomsModule } from './rooms/rooms.module';

// DB_HOST가 있을 때만 DB 연결 및 RoomsModule을 활성화한다.
const dbModules = env.DB_HOST ? [DatabaseModule, RoomsModule] : [];

@Module({
  imports: [
    JwtModule.register({ secret: env.JWT_SECRET }),
    ...dbModules,
  ],
  controllers: [HealthController],
  providers: [WsJwtGuard, ChatGateway],
})
export class AppModule {}
