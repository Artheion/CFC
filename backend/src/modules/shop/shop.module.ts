import { Module } from '@nestjs/common';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { ReferralsModule } from '../referrals/referrals.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [ReferralsModule, AdminModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
