import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../config/env';
import { ChatGateway } from './chat.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { RoomsModule } from '../rooms/rooms.module';
import { ChannelsModule } from '../channels/channels.module';

const dbModules = env.DB_HOST ? [RoomsModule, ChannelsModule] : [];

@Module({
  imports: [
    JwtModule.register({ secret: env.JWT_SECRET }),
    ...dbModules,
  ],
  providers: [WsJwtGuard, ChatGateway],
})
export class GatewayModule {}
