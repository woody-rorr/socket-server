import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { env } from '../config/env';

@Injectable()
export class IoAdapterService extends IoAdapter implements OnModuleInit {
  private readonly logger = new Logger(IoAdapterService.name);
  private redisAdapter: ReturnType<typeof createAdapter> | null = null;

  async onModuleInit() {
    if (!env.REDIS_HOST) {
      this.logger.warn('REDIS_HOST not set — Redis adapter disabled');
      return;
    }

    try {
      const pubClient = new Redis({ host: env.REDIS_HOST, port: env.REDIS_PORT, connectTimeout: 5000, lazyConnect: true });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.redisAdapter = createAdapter(pubClient, subClient);
      this.logger.log(`Redis adapter connected: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
    } catch (err) {
      this.logger.error(`Redis connection failed — adapter disabled: ${(err as Error).message}`);
    }
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.redisAdapter) {
      server.adapter(this.redisAdapter);
      this.logger.log('socket.io Redis adapter applied');
    }
    return server;
  }
}
