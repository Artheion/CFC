import { Module } from '@nestjs/common';
import { CocksService } from './cocks.service';
import { CocksController } from './cocks.controller';

@Module({
  controllers: [CocksController],
  providers: [CocksService],
  exports: [CocksService],
})
export class CocksModule {}
