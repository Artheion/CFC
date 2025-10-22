import { Module } from '@nestjs/common';
import { ChickensService } from './chickens.service';
import { ChickensController } from './chickens.controller';

@Module({
  controllers: [ChickensController],
  providers: [ChickensService],
  exports: [ChickensService],
})
export class ChickensModule {}
