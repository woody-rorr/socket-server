import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { env } from '../config/env';

export interface AuthedSocket extends Socket {
  data: { userId: string; email?: string };
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const client = ctx.switchToWs().getClient<AuthedSocket>();
    return !!client.data.userId;
  }

  // 핸드셰이크 시 1회 호출 — gateway의 handleConnection에서 사용.
  authenticate(client: Socket): { userId: string; email?: string } | null {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string) ||
      (client.handshake.headers?.authorization as string)?.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    try {
      const payload = this.jwt.verify(token, { secret: env.JWT_SECRET });
      return { userId: payload.sub, email: payload.email };
    } catch (err) {
      this.logger.warn(`JWT verify failed: ${(err as Error).message}`);
      return null;
    }
  }
}
