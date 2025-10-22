import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { ReferralPayoutProcessor } from '@jobs/referral-payout.processor';

@Module({
  controllers: [ReferralsController],
  providers: [ReferralsService, ReferralPayoutProcessor],
  exports: [ReferralsService],
})
export class ReferralsModule {}
