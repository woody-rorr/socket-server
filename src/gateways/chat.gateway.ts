import { Logger, Optional, UseGuards } from '@nestjs/common';
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
import { AuthedSocket, WsJwtGuard } from './ws-jwt.guard';

@WebSocketGateway({
  cors: { origin: env.CORS_ORIGINS, credentials: true },
  // 클라이언트가 path: '/socket.io' 기본값 사용.
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly auth: WsJwtGuard,
    @Optional() private readonly roomsService: RoomsService | null,
  ) {}

  afterInit(server: Server): void {
    this.logger.log(`Socket.io initialized (runtime=${env.RUNTIME})`);
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
    // 사용자별 개인 채널 join — DM 라우팅용
    client.join(`user:${identity.userId}`);
    this.logger.log(`connect ${client.id} userId=${identity.userId}`);
    client.emit('connected', { userId: identity.userId, ts: Date.now() });
  }

  handleDisconnect(client: Socket): void {
    const userId = (client as AuthedSocket).data?.userId;
    this.logger.log(`disconnect ${client.id} userId=${userId ?? '-'}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:join')
  async onJoinRoom(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomId?: string },
  ): Promise<{ ok: true; roomId: string }> {
    if (!body?.roomId) throw new WsException({ code: 'INVALID_ROOM' });

    // DB 연결이 있을 때: 방 존재 확인 + room_members upsert
    if (this.roomsService) {
      const exists = await this.roomsService.exists(body.roomId);
      if (!exists) {
        throw new WsException({ code: 'ROOM_NOT_FOUND', roomId: body.roomId });
      }

      await this.roomsService.upsertMember(body.roomId, {
        user_id: client.data.userId,
        role: 'member',
      });
    }

    client.join(`room:${body.roomId}`);
    this.logger.log(`userId=${client.data.userId} joined room=${body.roomId}`);
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

  // 서버 측에서 특정 사용자에게 메시지 push (다른 모듈/cron 등에서 호출)
  pushToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
