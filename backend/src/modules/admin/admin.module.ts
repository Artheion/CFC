import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ReferralsModule } from '../referrals/referrals.module';
import { CocksModule } from '../cocks/cocks.module';

@Module({
  imports: [ReferralsModule, CocksModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
