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
    return new Promise((resolve) => {
      const pubClient = new Redis({ host: env.REDIS_HOST, port: env.REDIS_PORT, connectTimeout: 5000 });
      const subClient = pubClient.duplicate();

      let pubReady = false;
      let subReady = false;

      const tryApply = () => {
        if (pubReady && subReady) {
          this.adapterConstructor = createAdapter(pubClient, subClient);
          this.logger.log(`Redis adapter connected: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
          resolve();
        }
      };

      pubClient.once('ready', () => { pubReady = true; tryApply(); });
      subClient.once('ready', () => { subReady = true; tryApply(); });

      pubClient.once('error', (err) => {
        this.logger.error(`Redis pub error: ${err.message}`);
        resolve();
      });
      subClient.once('error', (err) => {
        this.logger.error(`Redis sub error: ${err.message}`);
        resolve();
      });
    });
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
