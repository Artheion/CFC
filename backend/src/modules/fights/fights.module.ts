import { Module } from '@nestjs/common';
import { FightsController } from './fights.controller';
import { FightsService } from './fights.service';
import { FightEngineProcessor } from '@jobs/fight-engine.processor';

@Module({
  controllers: [FightsController],
  providers: [FightsService, FightEngineProcessor],
  exports: [FightsService],
})
export class FightsModule {}
