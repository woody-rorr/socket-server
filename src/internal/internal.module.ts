import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { GatewayModule } from '../gateways/gateway.module';

@Module({
  imports: [GatewayModule],
  controllers: [InternalController],
})
export class InternalModule {}
