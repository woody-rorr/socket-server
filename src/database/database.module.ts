import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { env } from '../config/env';
import { Room } from '../rooms/room.entity';
import { RoomMember } from '../rooms/room-member.entity';

const logger = new Logger('DatabaseModule');

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        if (!env.DB_HOST) {
          logger.warn('DB_HOST not set — skipping database connection');
          // TypeORM에 유효한 설정 없이 연결을 건너뛰려면
          // synchronize/autoLoadEntities 없이 빈 설정을 던지면 안 되므로
          // type을 'sqlite'로 설정하고 in-memory 모드를 사용한다.
          // 실제 DB 쿼리는 RoomsService에서만 발생하며,
          // DB_HOST가 없는 경우 RoomsModule을 import하지 않아 문제없다.
          return {
            type: 'better-sqlite3' as const,
            database: ':memory:',
            entities: [],
            synchronize: false,
          } as any;
        }

        logger.log(`Connecting to Aurora PostgreSQL at ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
        return {
          type: 'postgres' as const,
          host: env.DB_HOST,
          port: env.DB_PORT,
          database: env.DB_NAME,
          username: env.DB_USER,
          password: env.DB_PASSWORD,
          ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
          entities: [Room, RoomMember],
          synchronize: false,       // 테이블은 이미 생성돼 있으므로 false
          logging: env.NODE_ENV !== 'production',
          extra: {
            max: 5,                 // connection pool size (Fargate 소규모)
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
