import { Module } from '@nestjs/common';
import { env } from './config/env';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { GatewayModule } from './gateways/gateway.module';

const dbModules = env.DB_HOST ? [DatabaseModule] : [];

@Module({
  imports: [
    ...dbModules,
    GatewayModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
