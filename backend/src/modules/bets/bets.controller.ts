import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BetsService } from './bets.service';
import { PlaceBetDto } from './dto/place-bet.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

// Helper function to serialize bet with Decimal fields
function serializeBet(bet: any) {
  return {
    ...bet,
    amount: bet.amount.toString(),
    payoutAmount: bet.payoutAmount?.toString() || null,
  };
}

@Controller('bets')
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const bets = await this.betsService.listUserBets(req.user.userId);
    return bets.map(serializeBet);
  }

  @Post(':fightId')
  async place(
    @Req() req: AuthenticatedRequest,
    @Param('fightId') fightId: string,
    @Body() dto: PlaceBetDto,
  ) {
    const bet = await this.betsService.placeBet(req.user.userId, fightId, dto);
    return serializeBet(bet);
  }
}
