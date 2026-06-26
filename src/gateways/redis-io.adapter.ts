import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import { env } from '../config/env';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = new Redis({ host: env.REDIS_HOST, port: env.REDIS_PORT });
    const subClient = pubClient.duplicate();

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        pubClient.once('ready', resolve);
        pubClient.once('error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        subClient.once('ready', resolve);
        subClient.once('error', reject);
      }),
    ]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log(`Redis adapter connected: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
