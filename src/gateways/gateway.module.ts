import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../config/env';
import { ChatGateway } from './chat.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { RoomsModule } from '../rooms/rooms.module';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [
    JwtModule.register({ secret: env.JWT_SECRET }),
    RoomsModule,
    ChannelsModule,
  ],
  providers: [WsJwtGuard, ChatGateway],
})
export class GatewayModule {}
