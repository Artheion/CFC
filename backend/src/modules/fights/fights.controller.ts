import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { PrismaService } from '@infra/prisma/prisma.service';
import { EscrowService } from '@infra/escrow/escrow.service';
import { JOB_QUEUE_NAMES } from '@jobs/index';
import { FightsService } from './fights.service';
import { CreateFightDto } from './dto/create-fight.dto';
import { JoinFightDto } from './dto/join-fight.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

// Helper function to serialize fight with Decimal fields
function serializeFight(fight: any) {
  return {
    ...fight,
    wager: fight.wager.toString(),
    rakePaid: fight.rakePaid?.toString() || '0',
    referralPaid: fight.referralPaid?.toString() || '0',
    spectatorBets: fight.spectatorBets?.map((bet: any) => ({
      ...bet,
      amount: bet.amount.toString(),
      payoutAmount: bet.payoutAmount?.toString() || null,
    })) || [],
  };
}

@Controller('fights')
export class FightsController {
  constructor(
    private readonly fightsService: FightsService,
    private readonly escrowService: EscrowService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('queue')
  async listQueue() {
    const fights = await this.fightsService.listQueue();
    return fights.map(fight => ({
      ...fight,
      wager: fight.wager.toString(),
    }));
  }

  /**
   * 🐛 DEBUG ENDPOINT: Manually trigger fight processing
   * Remove this in production!
   */
  @Get(':id/debug/trigger')
  async debugTriggerFight(@Param('id') fightId: string) {
    console.log(`[DEBUG] Manually triggering fight: ${fightId}`);
    
    const fight = await this.prisma.fight.findUnique({
      where: { id: fightId },
      include: { cock1: true, cock2: true },
    });
    
    if (!fight) {
      return { success: false, error: 'Fight not found' };
    }
    
    console.log(`[DEBUG] Fight status: ${fight.status}`);
    console.log(`[DEBUG] Cock1: ${fight.cock1?.name || 'null'}`);
    console.log(`[DEBUG] Cock2: ${fight.cock2?.name || 'null'}`);
    
    // Manually add job to queue with NO delay for testing
    const job = await this.fightsService['queueService']
      .getQueue(JOB_QUEUE_NAMES.FIGHT_ENGINE)
      .add('start-fight', { fightId }, { 
        jobId: `debug-${fightId}-${Date.now()}`,
        delay: 0, // Process immediately
      });
    
    return { 
      success: true, 
      message: 'Fight job added to queue (0 delay)',
      jobId: job.id,
      fightId,
      fightStatus: fight.status,
    };
  }

  @Get('active')
  async listActive() {
    const fights = await this.fightsService.listActive();
    return fights.map(serializeFight);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async listHistory(@Req() req: AuthenticatedRequest, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50) : 20;
    const fights = await this.fightsService.listUserHistory(req.user.userId, parsedLimit);
    return fights.map(serializeFight);
  }

  @Get(':id')
  async getFight(@Param('id') fightId: string) {
    const fight = await this.fightsService.getFight(fightId);
    return serializeFight(fight);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createFight(@Req() req: AuthenticatedRequest, @Body() dto: CreateFightDto) {
    const fight = await this.fightsService.createFight(req.user.userId, dto);
    return {
      ...fight,
      wager: fight.wager.toString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  joinFight(
    @Req() req: AuthenticatedRequest,
    @Param('id') fightId: string,
    @Body() dto: JoinFightDto,
  ) {
    return this.fightsService.joinFight(req.user.userId, fightId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancelFight(@Req() req: AuthenticatedRequest, @Param('id') fightId: string) {
    return this.fightsService.cancelFight(req.user.userId, fightId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/payout')
  async getPotentialPayout(@Req() req: AuthenticatedRequest, @Param('id') fightId: string) {
    if (!this.escrowService.isConfigured()) {
      return {
        available: false,
        message: 'Escrow contract not configured',
        amount: '0',
      };
    }

    try {
      // Get user's wallet address
      const user = await this.prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { walletAddress: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get potential payout from contract
      const amount = await this.escrowService.calculatePotentialPayout(fightId, user.walletAddress);

      return {
        available: true,
        fightId,
        userAddress: user.walletAddress,
        amount,
        contractAddress: this.escrowService.getContractAddress(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get payout info';
      return {
        available: false,
        message,
        amount: '0',
      };
    }
  }

  @Get('contract/info')
  async getContractInfo() {
    if (!this.escrowService.isConfigured()) {
      return {
        configured: false,
      };
    }

    try {
      const constants = await this.escrowService.getContractConstants();
      return {
        configured: true,
        contractAddress: this.escrowService.getContractAddress(),
        ...constants,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get contract info';
      return {
        configured: false,
        error: message,
      };
    }
  }
}
