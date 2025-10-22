import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { WithdrawCfcDto } from './dto/withdraw-cfc.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    walletAddress: string;
  };
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Req() req: AuthenticatedRequest) {
    return this.usersService.getProfile(req.user.userId);
  }

  @Patch('me')
  async updateProfile(@Req() req: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  @Get('referral-info')
  async getReferralInfo(@Req() req: AuthenticatedRequest) {
    return this.usersService.getReferralInfo(req.user.userId);
  }

  @Get('claimable-cfc')
  async getClaimableCfc(@Req() req: AuthenticatedRequest) {
    return this.usersService.getClaimableCfc(req.user.userId);
  }

  @Post('mark-claimed-cfc')
  async markClaimedCfc(
    @Req() req: AuthenticatedRequest,
    @Body() body: { matchIds: string[]; transactionHash: string }
  ) {
    return this.usersService.markPayoutsClaimed(req.user.userId, body.matchIds, body.transactionHash);
  }
}
