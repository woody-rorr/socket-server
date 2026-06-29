import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        if (!env.REDIS_HOST) return null;
        return new Redis({ host: env.REDIS_HOST, port: env.REDIS_PORT, connectTimeout: 5000 });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
