import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { GatewayModule } from './gateways/gateway.module';
import { RedisModule } from './redis/redis.module';
import { InternalModule } from './internal/internal.module';

@Module({
  imports: [RedisModule, DatabaseModule, GatewayModule, InternalModule],
  controllers: [HealthController],
})
export class AppModule {}
