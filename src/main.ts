import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './config/env';
import { RedisIoAdapter } from './gateways/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: { origin: env.CORS_ORIGINS, credentials: true } });
  const logger = new Logger('Bootstrap');

  app.enableShutdownHooks();

  if (env.REDIS_HOST) {
    try {
      const redisAdapter = new RedisIoAdapter(app);
      await redisAdapter.connectToRedis();
      app.useWebSocketAdapter(redisAdapter);
    } catch (err) {
      logger.warn(`Redis adapter setup failed — continuing without: ${(err as Error).message}`);
    }
  }

  const server = await app.listen(env.PORT);
  logger.log(`rorr-socket-server on :${env.PORT} (runtime=${env.RUNTIME})`);

  let shuttingDown = false;
  const shutdown = async (sig: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.warn(`${sig} received — graceful shutdown (${env.GRACEFUL_SHUTDOWN_MS}ms)`);

    setTimeout(async () => {
      await app.close();
      server.close(() => process.exit(0));
    }, env.GRACEFUL_SHUTDOWN_MS);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap();
