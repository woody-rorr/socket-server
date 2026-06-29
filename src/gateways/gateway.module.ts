import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../config/env';
import { SocketGateway } from './socket.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { SocketStateService } from './socket-state.service';
import { RoomsModule } from '../rooms/rooms.module';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [
    JwtModule.register({ secret: env.JWT_SECRET }),
    RoomsModule,
    ChannelsModule,
  ],
  providers: [WsJwtGuard, SocketGateway, SocketStateService],
  exports: [SocketGateway, SocketStateService],
})
export class GatewayModule {}
