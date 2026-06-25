import { Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { RoomsService } from '../rooms/rooms.service';
import { ChannelsService } from '../channels/channels.service';
import { AuthedSocket, ClientType, WsJwtGuard } from './ws-jwt.guard';

@WebSocketGateway({
  cors: { origin: env.CORS_ORIGINS, credentials: true },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly auth: WsJwtGuard,
    private readonly roomsService: RoomsService,
    private readonly channelsService: ChannelsService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log(`Socket.io initialized (runtime=${env.RUNTIME})`);
    this.logger.log(`RoomsService injected: ${!!this.roomsService}`);
    this.logger.log(`ChannelsService injected: ${!!this.channelsService}`);
    server.engine.on('connection_error', (err) => {
      this.logger.warn(`engine connection_error: ${err.code} ${err.message}`);
    });
  }

  handleConnection(client: Socket): void {
    const identity = this.auth.authenticate(client);
    if (!identity) {
      this.logger.warn(`reject ${client.id}: unauthenticated`);
      client.emit('error', { code: 'UNAUTHENTICATED', message: 'invalid or missing token' });
      client.disconnect(true);
      return;
    }
    (client as AuthedSocket).data = identity;

    // 사용자 개인 room — DM 라우팅용
    client.join(`user:${identity.userId}`);

    // 채널 room join — 전체 + clientType별 (web/overlay/side)
    if (identity.channelId) {
      client.join(`channel:${identity.channelId}`);
      client.join(`channel:${identity.channelId}:${identity.clientType}`);
    }

    this.logger.log(
      `connect ${client.id} userId=${identity.userId} clientType=${identity.clientType} channelId=${identity.channelId || '-'}`,
    );
    client.emit('connected', {
      userId: identity.userId,
      clientType: identity.clientType,
      channelId: identity.channelId,
      ts: Date.now(),
    });
  }

  handleDisconnect(client: Socket): void {
    const { userId, clientType, channelId } = (client as AuthedSocket).data ?? {};
    this.logger.log(
      `disconnect ${client.id} userId=${userId ?? '-'} clientType=${clientType ?? '-'} channelId=${channelId ?? '-'}`,
    );

    if (userId) {
      this.roomsService.removeAllByUserId(userId)
        .then((count) => {
          if (count > 0) this.logger.log(`room_members 삭제 userId=${userId} count=${count}`);
        })
        .catch((err) => this.logger.warn(`room_members 삭제 실패 userId=${userId}: ${err.message}`));
    }
  }

  // ── Channel broadcast ──────────────────────────────────────────────────────
  // 외부(MSK consumer, 게임 이벤트 핸들러 등)에서 채널 전체 또는 clientType 지정 push
  pushToChannel(channelId: string, event: string, payload: unknown, clientType?: ClientType): void {
    const room = clientType ? `channel:${channelId}:${clientType}` : `channel:${channelId}`;
    this.server.to(room).emit(event, payload);
  }

  // 특정 사용자에게 push (DM, 알림 등)
  pushToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  // ── Room events ────────────────────────────────────────────────────────────
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:join')
  async onJoinRoom(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomId?: string },
  ): Promise<{ ok: true; roomId: string }> {
    if (!body?.roomId) throw new WsException({ code: 'INVALID_ROOM' });

    const room = await this.roomsService.findOne(body.roomId).catch(() => null);
    if (!room) throw new WsException({ code: 'ROOM_NOT_FOUND', roomId: body.roomId });

    if (room.channel_id && room.channel_id !== client.data.channelId) {
      throw new WsException({ code: 'CHANNEL_MISMATCH', roomId: body.roomId });
    }

    await this.roomsService.upsertMember(body.roomId, {
      user_id: client.data.userId,
      role: 'member',
    });

    client.join(`room:${body.roomId}`);
    this.logger.log(
      `userId=${client.data.userId} joined room=${body.roomId} channelId=${client.data.channelId || '-'}`,
    );
    return { ok: true, roomId: body.roomId };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:leave')
  onLeaveRoom(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomId?: string },
  ): { ok: true } {
    if (!body?.roomId) throw new WsException({ code: 'INVALID_ROOM' });
    client.leave(`room:${body.roomId}`);
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:message')
  onRoomMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomId?: string; text?: string },
  ): { ok: true } {
    if (!body?.roomId || !body?.text) throw new WsException({ code: 'INVALID_PAYLOAD' });
    this.server.to(`room:${body.roomId}`).emit('room:message', {
      roomId: body.roomId,
      from: client.data.userId,
      clientType: client.data.clientType,
      text: body.text,
      ts: Date.now(),
    });
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('ping')
  onPing(): { pong: number } {
    return { pong: Date.now() };
  }
}
