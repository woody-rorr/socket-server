import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IoAdapterModule } from './io-adapter.module';
import { env } from '../config/env';
import { SocketGateway } from './socket.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { RoomsModule } from '../rooms/rooms.module';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [
    JwtModule.register({ secret: env.JWT_SECRET }),
    IoAdapterModule,
    RoomsModule,
    ChannelsModule,
  ],
  providers: [WsJwtGuard, SocketGateway],
})
export class GatewayModule {}
