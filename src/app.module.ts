import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from './config/env';
import { ChatGateway } from './gateways/chat.gateway';
import { WsJwtGuard } from './gateways/ws-jwt.guard';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { RoomsModule } from './rooms/rooms.module';
import { ChannelsModule } from './channels/channels.module';

// DB_HOST가 있을 때만 DB 연결 및 관련 모듈을 활성화한다.
const dbModules = env.DB_HOST ? [DatabaseModule, ChannelsModule, RoomsModule] : [];

@Module({
  imports: [
    JwtModule.register({ secret: env.JWT_SECRET }),
    ...dbModules,
  ],
  controllers: [HealthController],
  // ChatGateway가 RoomsService/ChannelsService를 주입받으려면
  // 같은 모듈 컨텍스트에서 provider로 등록돼야 한다.
  // RoomsModule/ChannelsModule이 export하는 서비스를 AppModule이 import하면 주입 가능.
  providers: [WsJwtGuard, ChatGateway],
})
export class AppModule {}
