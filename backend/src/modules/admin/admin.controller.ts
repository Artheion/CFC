import { Controller, Get, Patch, Post, Body, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { ReferralsService } from '../referrals/referrals.service';
import { CocksService } from '../cocks/cocks.service';
import { UpdatePricesDto } from './dto/update-prices.dto';
import { ResetReferralEarningsDto } from './dto/reset-referral-earnings.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    walletAddress: string;
  };
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly referralsService: ReferralsService,
    private readonly cocksService: CocksService,
  ) {}

  @Get('referrals')
  async listReferrals(@Req() req: AuthenticatedRequest) {
    await this.adminService.assertIsAdmin(req.user.userId);
    return this.referralsService.listCodesForAdmin(req.user.userId);
  }

  @Get('cocks')
  async listAllCocks(@Req() req: AuthenticatedRequest) {
    await this.adminService.assertIsAdmin(req.user.userId);
    return this.cocksService.listAllCocks();
  }

  @Patch('prices')
  async updatePrices(@Req() req: AuthenticatedRequest, @Body() dto: UpdatePricesDto) {
    return this.adminService.updatePrices(req.user.userId, dto);
  }



  @Post('reset-referral-earnings')
  async resetReferralEarnings(@Req() req: AuthenticatedRequest, @Body() dto: ResetReferralEarningsDto) {
    return this.adminService.resetReferralEarnings(req.user.userId, dto.code);
  }
}
