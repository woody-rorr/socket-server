import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapterService } from './gateways/io-adapter.service';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: { origin: env.CORS_ORIGINS, credentials: true } });
  const logger = new Logger('Bootstrap');

  // Graceful shutdown — systemd stop(SIGTERM) 대응
  // 1) 기존 클라이언트에 재연결 권고 신호
  // 2) GRACEFUL_SHUTDOWN_MS 대기 후 종료
  app.enableShutdownHooks();

  const ioAdapter = app.get(IoAdapterService);
  app.useWebSocketAdapter(ioAdapter);

  const server = await app.listen(env.PORT);
  logger.log(`rorr-socket-server on :${env.PORT} (runtime=${env.RUNTIME})`);

  let shuttingDown = false;
  const shutdown = async (sig: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.warn(`${sig} received — graceful shutdown (${env.GRACEFUL_SHUTDOWN_MS}ms)`);

    try {
      const io = app.get('SocketIoServer', { strict: false }) as any;
      if (io && typeof io.emit === 'function') {
        io.emit('server:reconnect', { reason: sig, ts: Date.now() });
      }
    } catch {
      /* noop */
    }

    setTimeout(async () => {
      await app.close();
      server.close(() => process.exit(0));
    }, env.GRACEFUL_SHUTDOWN_MS);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap();
