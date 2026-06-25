import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { GatewayModule } from './gateways/gateway.module';

@Module({
  imports: [DatabaseModule, GatewayModule],
  controllers: [HealthController],
})
export class AppModule {}
