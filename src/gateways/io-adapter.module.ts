import { Module } from '@nestjs/common';
import { IoAdapterService } from './io-adapter.service';

@Module({
  providers: [IoAdapterService],
  exports: [IoAdapterService],
})
export class IoAdapterModule {}
