import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Cluster } from 'ioredis';
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

    const clusterNodes = [{ host: env.REDIS_HOST, port: env.REDIS_PORT }];
    const pubClient = new Cluster(clusterNodes, { dnsLookup: (addr: string, cb: (err: Error | null, addr: string, family: number) => void) => cb(null, addr, 4), redisOptions: { tls: {} } });
    const subClient = pubClient.duplicate();

    await Promise.all([
      new Promise<void>((res) => pubClient.once('ready', res)),
      new Promise<void>((res) => subClient.once('ready', res)),
    ]);

    this.redisAdapter = createAdapter(pubClient, subClient);
    this.logger.log(`Redis adapter connected: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
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
