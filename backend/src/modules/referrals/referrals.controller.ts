import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReferralsService } from './referrals.service';
import { ApplyReferralDto } from './dto/apply-referral.dto';
import { UpdateReferralSettingsDto } from './dto/update-referral-settings.dto';
import { WithdrawEarningsDto } from './dto/withdraw-earnings.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    walletAddress: string;
  };
}

@Controller('referrals')
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('me')
  async getMyReferral(@Req() req: AuthenticatedRequest) {
    return this.referralsService.getReferralStats(req.user.userId);
  }

  @Post('apply')
  async applyReferral(@Req() req: AuthenticatedRequest, @Body() dto: ApplyReferralDto) {
    return this.referralsService.applyCode(req.user.userId, dto.code);
  }

  @Get('admin/codes')
  async listCodes(@Req() req: AuthenticatedRequest) {
    return this.referralsService.listCodesForAdmin(req.user.userId);
  }

  @Patch(':code')
  async updateCode(
    @Req() req: AuthenticatedRequest,
    @Param('code') code: string,
    @Body() dto: UpdateReferralSettingsDto,
  ) {
    return this.referralsService.updateReferralSettings(req.user.userId, code, dto);
  }

  @Post('withdraw')
  async withdrawEarnings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: WithdrawEarningsDto,
  ) {
    return this.referralsService.withdrawEarnings(req.user.userId, dto.amount);
  }
}
