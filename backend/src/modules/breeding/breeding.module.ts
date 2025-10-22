import { Module } from '@nestjs/common';
import { PrismaModule } from '@infra/prisma/prisma.module';
import { BreedingController } from './breeding.controller';
import { BreedingService } from './breeding.service';

@Module({
  imports: [PrismaModule],
  controllers: [BreedingController],
  providers: [BreedingService],
  exports: [BreedingService],
})
export class BreedingModule {}
