import { Module } from '@nestjs/common';
import { EconomyService } from './economy.service';
import { EconomyProcessor } from '@jobs/economy.processor';

@Module({
  providers: [EconomyService, EconomyProcessor],
  exports: [EconomyService],
})
export class EconomyModule {}
