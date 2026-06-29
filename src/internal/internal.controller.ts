import { Body, Controller, Get, Param, Post, Query, UseGuards, HttpCode } from '@nestjs/common';
import { InternalAuthGuard } from './internal-auth.guard';
import { SocketGateway } from '../gateways/socket.gateway';
import { SocketStateService } from '../gateways/socket-state.service';
import { ClientType } from '../gateways/ws-jwt.guard';

class PushDto {
  channelId?: string;
  userId?: string;
  clientType?: ClientType;
  event: string;
  payload: unknown;
}

@Controller('internal')
@UseGuards(InternalAuthGuard)
export class InternalController {
  constructor(
    private readonly gateway: SocketGateway,
    private readonly socketState: SocketStateService,
  ) {}

  @Post('push')
  @HttpCode(200)
  push(@Body() dto: PushDto): { ok: true } {
    if (dto.userId) {
      this.gateway.pushToUser(dto.userId, dto.event, dto.payload);
    } else if (dto.channelId) {
      this.gateway.pushToChannel(dto.channelId, dto.event, dto.payload, dto.clientType);
    }
    return { ok: true };
  }

  @Get('connections/channel/:channelId')
  getChannelConnections(
    @Param('channelId') channelId: string,
    @Query('clientType') clientType?: ClientType,
  ) {
    return this.socketState.getChannelConnections(channelId, clientType);
  }

  @Get('connections/user/:userId')
  getUserConnections(@Param('userId') userId: string) {
    return this.socketState.getUserConnections(userId);
  }
}
