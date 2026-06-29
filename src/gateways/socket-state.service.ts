import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { ClientType } from './ws-jwt.guard';

interface ConnectionIdentity {
  userId: string;
  clientType: ClientType;
  channelId: string;
}

const CONN_TTL = 60;

@Injectable()
export class SocketStateService {
  private readonly logger = new Logger(SocketStateService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  async addConnection(socketId: string, identity: ConnectionIdentity): Promise<void> {
    if (!this.redis) return;
    const { userId, clientType, channelId } = identity;
    const pipeline = this.redis.pipeline();
    pipeline.hset(`conn:${socketId}`, { userId, clientType, channelId, connectedAt: Date.now() });
    pipeline.expire(`conn:${socketId}`, CONN_TTL);
    if (channelId) {
      pipeline.sadd(`channel:${channelId}:conns`, socketId);
      pipeline.sadd(`channel:${channelId}:${clientType}:conns`, socketId);
    }
    pipeline.sadd(`user:${userId}:conns`, socketId);
    await pipeline.exec();
    this.logger.debug(`addConnection ${socketId} userId=${userId} channelId=${channelId}`);
  }

  async removeConnection(socketId: string): Promise<void> {
    if (!this.redis) return;
    const identity = await this.redis.hgetall(`conn:${socketId}`);
    if (!identity?.userId) return;
    const { userId, clientType, channelId } = identity;
    const pipeline = this.redis.pipeline();
    pipeline.del(`conn:${socketId}`);
    pipeline.srem(`user:${userId}:conns`, socketId);
    if (channelId) {
      pipeline.srem(`channel:${channelId}:conns`, socketId);
      pipeline.srem(`channel:${channelId}:${clientType}:conns`, socketId);
    }
    await pipeline.exec();
    this.logger.debug(`removeConnection ${socketId} userId=${userId}`);
  }

  async refreshTTL(socketId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.expire(`conn:${socketId}`, CONN_TTL);
  }

  async getChannelConnections(channelId: string, clientType?: ClientType): Promise<{ socketId: string; userId: string }[]> {
    if (!this.redis) return [];
    const key = clientType ? `channel:${channelId}:${clientType}:conns` : `channel:${channelId}:conns`;
    const socketIds = await this.redis.smembers(key);
    const results: { socketId: string; userId: string }[] = [];
    for (const socketId of socketIds) {
      const info = await this.redis.hgetall(`conn:${socketId}`);
      if (info?.userId) {
        results.push({ socketId, userId: info.userId });
      } else {
        // 좀비 정리
        await this.redis.srem(key, socketId);
      }
    }
    return results;
  }

  async getUserConnections(userId: string): Promise<string[]> {
    if (!this.redis) return [];
    return this.redis.smembers(`user:${userId}:conns`);
  }

  async getConnectionInfo(socketId: string): Promise<ConnectionIdentity | null> {
    if (!this.redis) return null;
    const data = await this.redis.hgetall(`conn:${socketId}`);
    if (!data?.userId) return null;
    return { userId: data.userId, clientType: data.clientType as ClientType, channelId: data.channelId };
  }
}
