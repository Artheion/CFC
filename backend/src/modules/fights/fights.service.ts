import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, FightStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '@infra/prisma/prisma.service';
import { QueueService } from '@infra/queue/queue.service';
import { EscrowService } from '@infra/escrow/escrow.service';
import { JOB_QUEUE_NAMES } from '@jobs/index';
import { CreateFightDto } from './dto/create-fight.dto';
import { JoinFightDto } from './dto/join-fight.dto';

const OWNER_SELECT = {
  walletAddress: true,
  username: true,
} as const;

const QUEUE_FIGHT_INCLUDE: Prisma.FightInclude = {
  cock1: {
    include: {
      owner: {
        select: OWNER_SELECT,
      },
    },
  },
  cock2: {
    include: {
      owner: {
        select: OWNER_SELECT,
      },
    },
  },
};

const FULL_FIGHT_INCLUDE: Prisma.FightInclude = {
  cock1: QUEUE_FIGHT_INCLUDE.cock1,
  cock2: QUEUE_FIGHT_INCLUDE.cock2,
  rounds: {
    orderBy: { roundNo: 'asc' },
  },
  spectatorBets: {
    include: {
      user: {
        select: OWNER_SELECT,
      },
    },
    orderBy: { placedAt: 'asc' },
  },
};

@Injectable()
export class FightsService {
  private static readonly DEFAULT_HOUSE_RAKE_BPS = 700; // 7%

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly escrowService: EscrowService,
  ) {}

  listQueue() {
    return this.prisma.fight.findMany({
      where: { status: FightStatus.QUEUED },
      orderBy: { createdAt: 'asc' },
      include: QUEUE_FIGHT_INCLUDE,
    });
  }

  listActive() {
    return this.prisma.fight.findMany({
      where: { status: { in: [FightStatus.BETTING, FightStatus.FIGHTING] } },
      orderBy: { createdAt: 'desc' },
      include: FULL_FIGHT_INCLUDE,
    });
  }

  listUserHistory(userId: string, limit = 20) {
    return this.prisma.fight.findMany({
      where: {
        status: FightStatus.FINISHED,
        OR: [{ cock1: { ownerId: userId } }, { cock2: { ownerId: userId } }],
      },
      orderBy: { settledAt: 'desc' },
      take: limit,
      include: FULL_FIGHT_INCLUDE,
    });
  }

  async getFight(fightId: string) {
    const fight = await this.prisma.fight.findUnique({
      where: { id: fightId },
      include: FULL_FIGHT_INCLUDE,
    });

    if (!fight) {
      throw new NotFoundException('Fight not found');
    }

    return fight;
  }

  async createFight(userId: string, dto: CreateFightDto) {
    const cock = await this.prisma.cock.findFirst({
      where: { id: dto.cockId, ownerId: userId },
    });
    if (!cock) {
      throw new NotFoundException('Cock not found');
    }

    await this.ensureCockAvailable(cock.id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wager = new Prisma.Decimal(dto.wager);
    const queueId = randomUUID();
    // Use provided fightId if available (for escrow integration), otherwise generate new one
    const fightId = dto.fightId || randomUUID();

    // Create fight in database
    const fight = await this.prisma.fight.create({
      data: {
        id: fightId,
        cock1Id: cock.id,
        wager,
        status: FightStatus.QUEUED,
        queueId,
        cock1StakeSignature: dto.paymentSignature || null,
        houseRakeBps: FightsService.DEFAULT_HOUSE_RAKE_BPS,
      },
      include: QUEUE_FIGHT_INCLUDE,
    });

    // Note: On-chain verification happens later after frontend calls createMatch()
    // Frontend flow: 
    // 1. Get fight ID from this response
    // 2. Call contract.createMatch() with this fight ID
    // 3. Contract escrows tokens

    return fight;
  }

  async joinFight(userId: string, fightId: string, dto: JoinFightDto) {
    const fight = await this.prisma.fight.findUnique({
      where: { id: fightId },
      include: { cock1: true },
    });

    if (!fight) {
      throw new NotFoundException('Fight not found');
    }

    if (fight.status !== FightStatus.QUEUED) {
      throw new BadRequestException('Fight is not open for joining');
    }

    const joinerCock = await this.prisma.cock.findFirst({
      where: { id: dto.cockId, ownerId: userId },
    });

    if (!joinerCock) {
      throw new NotFoundException('Cock not found');
    }

    if (joinerCock.ownerId === fight.cock1.ownerId) {
      throw new BadRequestException('Cannot fight against your own cock');
    }

    await this.ensureCockAvailable(joinerCock.id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Note: On-chain verification happens in frontend before calling this
    // Frontend calls contract.joinMatch() first, then calls this API

    // Calculate betting end time (3 minutes from now)
    const now = Date.now();
    const bettingEndTime = now + 180000; // 3 minutes in milliseconds

    const updatedFight = await this.prisma.fight.update({
      where: { id: fightId },
      data: {
        cock2Id: joinerCock.id,
        cock2StakeSignature: dto.paymentSignature || null,
        status: FightStatus.BETTING,
        metadata: {
          bettingEndTime,
        },
      },
      include: FULL_FIGHT_INCLUDE,
    });

    // Add fight to queue with 3 minute delay for betting phase
    console.log(`[FightsService] 📋 Adding fight ${fightId} to queue with 3 minute delay`);
    
    try {
      const job = await this.queueService
        .getQueue(JOB_QUEUE_NAMES.FIGHT_ENGINE)
        .add(
          'start-fight',
          { fightId },
          {
            jobId: fightId,
            delay: 180000, // 3 minute betting phase (180 seconds)
            removeOnComplete: {
              count: 100, // Keep last 100 completed fights
              age: 3600, // Remove completed jobs older than 1 hour
            },
            removeOnFail: {
              count: 50, // Keep last 50 failed jobs for debugging
              age: 86400, // Remove failed jobs after 24 hours
            },
            attempts: 3, // Retry up to 3 times on failure
            backoff: {
              type: 'exponential',
              delay: 5000, // Start with 5 second delay
            },
          },
        );
      
      console.log(`[FightsService] ✅ Fight job ${job.id} added to queue successfully`);
      console.log(`[FightsService] 📅 Will process at ${new Date(job.timestamp + 180000).toISOString()}`);
      console.log(`[FightsService] 🎯 Job details:`, {
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
      });
      
      // Verify the job was added to the queue
      const jobFromQueue = await this.queueService.getQueue(JOB_QUEUE_NAMES.FIGHT_ENGINE).getJob(fightId);
      if (jobFromQueue) {
        console.log(`[FightsService] ✅ Verified: Job ${fightId} is in queue`);
      } else {
        console.log(`[FightsService] ⚠️  WARNING: Job ${fightId} not found in queue after adding!`);
      }
    } catch (error) {
      console.error(`[FightsService] ❌ Failed to add fight ${fightId} to queue:`, error);
      throw new Error('Failed to queue fight for processing. Check Redis connection.');
    }

    return updatedFight;
  }

  /**
   * Frontend calls this when all round animations complete
   * This is when we mark fight as FINISHED and credit winner
   */
  async completeFightAnimations(fightId: string) {
    console.log(`[FightsService] 🎬 Frontend completed animations for fight ${fightId}`);
    
    const fight = await this.prisma.fight.findUnique({
      where: { id: fightId },
      include: {
        cock1: true,
        cock2: true,
        rounds: true,
      },
    });

    if (!fight) {
      throw new NotFoundException('Fight not found');
    }

    if (fight.status !== FightStatus.FIGHTING) {
      throw new BadRequestException(`Fight is not in FIGHTING status (current: ${fight.status})`);
    }

    // Get winner from metadata (stored securely by backend)
    const winnerFromMetadata = (fight.metadata as any)?._internalWinner;
    
    if (!winnerFromMetadata) {
      throw new BadRequestException('Fight simulation not complete yet');
    }

    console.log(`[FightsService] ✅ Marking fight ${fightId} as FINISHED`);
    console.log(`[FightsService] 🏆 Winner: ${winnerFromMetadata === fight.cock1.id ? fight.cock1.name : fight.cock2?.name}`);
    console.log(`[FightsService] 🔒 SECURITY: Winner now publicly visible (animations complete)`);

    // Mark as FINISHED and NOW set the winner (after animations complete)
    const updatedFight = await this.prisma.fight.update({
      where: { id: fightId },
      data: {
        status: FightStatus.FINISHED,
        settledAt: new Date(),
        winnerCockId: winnerFromMetadata, // ✅ NOW it's safe to expose the winner
      },
    });

    // Now distribute rewards
    console.log(`[FightsService] 💰 Distributing rewards...`);
    await this.distributeFightRewards(fightId, winnerFromMetadata);

    console.log(`[FightsService] ✅ Fight ${fightId} complete!`);
    
    return {
      success: true,
      fightId,
      winnerId: winnerFromMetadata,
      status: FightStatus.FINISHED,
    };
  }

  /**
   * Get fight rounds for replay
   */
  async getFightRounds(fightId: string) {
    const fight = await this.prisma.fight.findUnique({
      where: { id: fightId },
      include: {
        rounds: {
          orderBy: { roundNo: 'asc' },
        },
        cock1: true,
        cock2: true,
      },
    });

    if (!fight) {
      throw new NotFoundException('Fight not found');
    }

    // ✅ CALCULATE CURRENT ROUND AND PROGRESS
    // This ensures everyone sees the same thing at the same time
    let currentRound = 1;
    let timeIntoCurrentRound = 0;
    let currentCock1Health = 100;
    let currentCock2Health = 100;
    
    if (fight.status === FightStatus.FIGHTING && fight.startedAt) {
      const COUNTDOWN_MS = 5000; // 5 seconds countdown
      const ROUND_DURATION_MS = 15000; // 15 seconds per round animation
      const ROUND_BREAK_MS = 3000; // 3 seconds between rounds
      
      const elapsedMs = Date.now() - fight.startedAt.getTime();
      const afterCountdown = Math.max(0, elapsedMs - COUNTDOWN_MS);
      
      // Calculate which round we're in based on time
      const timePerRound = ROUND_DURATION_MS + ROUND_BREAK_MS;
      const roundIndex = Math.floor(afterCountdown / timePerRound);
      currentRound = Math.min(roundIndex + 1, fight.rounds.length);
      timeIntoCurrentRound = afterCountdown % timePerRound;
      
      // Get health from previous round's end state
      if (currentRound > 1 && fight.rounds[currentRound - 2]) {
        const prevRound = fight.rounds[currentRound - 2];
        currentCock1Health = prevRound.cock1Health;
        currentCock2Health = prevRound.cock2Health;
      }
      
      // If we're in the break between rounds, show previous round's final health
      if (timeIntoCurrentRound > ROUND_DURATION_MS) {
        const currentRoundData = fight.rounds[currentRound - 1];
        if (currentRoundData) {
          currentCock1Health = currentRoundData.cock1Health;
          currentCock2Health = currentRoundData.cock2Health;
        }
      }
    }

    return {
      fightId,
      status: fight.status,
      winnerId: fight.winnerCockId,
      startedAt: fight.startedAt?.toISOString(),
      
      // ✅ CURRENT STATE (for sync)
      currentRound,
      timeIntoCurrentRound,
      currentCock1Health,
      currentCock2Health,
      
      cock1: {
        id: fight.cock1.id,
        name: fight.cock1.name,
        image: fight.cock1.image,
        attack: fight.cock1.attack,
        defence: fight.cock1.defence,
        speed: fight.cock1.speed,
        stamina: fight.cock1.stamina,
      },
      cock2: fight.cock2 ? {
        id: fight.cock2.id,
        name: fight.cock2.name,
        image: fight.cock2.image,
        attack: fight.cock2.attack,
        defence: fight.cock2.defence,
        speed: fight.cock2.speed,
        stamina: fight.cock2.stamina,
      } : null,
      rounds: fight.rounds.map(round => ({
        roundNo: round.roundNo,
        winnerId: round.winnerCock,
        cock1Health: round.cock1Health,
        cock2Health: round.cock2Health,
        durationMs: round.durationMs,
      })),
      metadata: fight.metadata,
    };
  }

  /**
   * Distribute rewards after fight completes
   */
  private async distributeFightRewards(fightId: string, winnerId: string) {
    console.log(`[FightsService] 💰 Distributing rewards for fight ${fightId}`);
    
    const fight = await this.prisma.fight.findUnique({
      where: { id: fightId },
      include: { 
        spectatorBets: true,
        cock1: true,
        cock2: true,
    });

    if (!fight || !fight.cock1 || !fight.cock2) {
      console.error('[FightsService] ❌ Fight or cocks not found for reward distribution');
      return;
    }

    const loserCockId = winnerId === fight.cock1.id ? fight.cock2.id : fight.cock1.id;
    const winnerCock = winnerId === fight.cock1.id ? fight.cock1 : fight.cock2;
    const loserCock = loserCockId === fight.cock1.id ? fight.cock1 : fight.cock2;

    await this.prisma.$transaction(async (tx) => {
      // Calculate winner earnings (opponent's wager = net profit)
      const wagerAmount = parseFloat(fight.wager.toString());
      const netWinnings = wagerAmount;

      // Calculate energy/health loss (3 rounds max for Best-of-3)
      const numRounds = 3;
      const energyCost = Math.min(winnerCock.energy, numRounds * 10);
      const healthCost = Math.min(winnerCock.health, numRounds * 5);

      // Update winner stats
      await tx.cock.update({
        where: { id: winnerId },
        data: {
          wins: { increment: 1 },
          earningsCfc: { increment: netWinnings },
          energy: Math.max(0, winnerCock.energy - energyCost),
          health: Math.max(0, winnerCock.health - healthCost),
          lastRecoveryAt: new Date(),
          energyUpdatedAt: new Date(),
          healthUpdatedAt: new Date(),
        },
      });

      // Update loser stats
      const loserEnergyCost = Math.min(loserCock.energy, numRounds * 15);
      const loserHealthCost = Math.min(loserCock.health, numRounds * 10);

      await tx.cock.update({
        where: { id: loserCockId },
        data: {
          losses: { increment: 1 },
          energy: Math.max(0, loserCock.energy - loserEnergyCost),
          health: Math.max(0, loserCock.health - loserHealthCost),
          lastRecoveryAt: new Date(),
          energyUpdatedAt: new Date(),
          healthUpdatedAt: new Date(),
        },
      });

      // Process spectator bets
      const winningBets = fight.spectatorBets.filter(bet => bet.cockId === winnerId);
      const losingBets = fight.spectatorBets.filter(bet => bet.cockId === loserCockId);

      const totalWinningBetAmount = winningBets.reduce((sum, bet) => sum + parseFloat(bet.amount.toString()), 0);
      const totalLosingBetAmount = losingBets.reduce((sum, bet) => sum + parseFloat(bet.amount.toString()), 0);
      const totalSpectatorPool = totalWinningBetAmount + totalLosingBetAmount;

      console.log(`[FightsService] 💰 Bet pool: ${totalSpectatorPool} (Winners: ${totalWinningBetAmount}, Losers: ${totalLosingBetAmount})`);

      // Pay out winning bettors proportionally
      for (const bet of winningBets) {
        const betAmount = parseFloat(bet.amount.toString());
        const betShare = totalWinningBetAmount > 0 ? betAmount / totalWinningBetAmount : 0;
        const payout = betAmount + (totalLosingBetAmount * betShare); // Return bet + share of losing bets

        await tx.spectatorBet.update({
          where: { id: bet.id },
          data: {
            status: SpectatorBetStatus.WON,
            payoutAmount: new Prisma.Decimal(payout),
          },
        });

        console.log(`[FightsService] ✅ Bettor ${bet.userId} won ${payout} CFC (bet: ${betAmount})`);
      }

      // Mark losing bets
      for (const bet of losingBets) {
        await tx.spectatorBet.update({
          where: { id: bet.id },
          data: {
            status: SpectatorBetStatus.LOST,
            payoutAmount: new Prisma.Decimal(0),
          },
        });
      }
    });

    this.logger.log(`Fight ${fightId} payouts processed successfully`);
  }

  async cancelFight(userId: string, fightId: string) {
    const fight = await this.prisma.fight.findUnique({
      where: { id: fightId },
      include: { cock1: true },
    });

    if (!fight) {
      throw new NotFoundException('Fight not found');
    }

    if (fight.cock1.ownerId !== userId) {
      throw new ForbiddenException('Only the creator can cancel this fight');
    }

    if (fight.status !== FightStatus.QUEUED) {
      throw new BadRequestException('Fight is already in progress');
    }

    // Cancel match on smart contract FIRST (so users can claim refunds)
    if (this.escrowService.isConfigured()) {
      try {
        const txHash = await this.escrowService.cancelMatch(fightId);
        console.log(`✅ Match ${fightId} cancelled on contract: ${txHash}`);
      } catch (error) {
        console.error(`❌ Failed to cancel match ${fightId} on contract:`, error);
        // Continue with DB cancellation even if contract fails
        // Users can still claim if contract state is correct
      }
    } else {
      console.warn(`⚠️  Escrow not configured - skipping on-chain cancellation for fight ${fightId}`);
    }

    // Then update database
    return this.prisma.fight.update({
      where: { id: fightId },
      data: { status: FightStatus.CANCELLED },
      include: QUEUE_FIGHT_INCLUDE,
    });
  }

  private async ensureCockAvailable(cockId: string) {
    const activeFight = await this.prisma.fight.findFirst({
      where: {
        status: { in: [FightStatus.QUEUED, FightStatus.BETTING, FightStatus.FIGHTING] },
        OR: [{ cock1Id: cockId }, { cock2Id: cockId }],
      },
    });

    if (activeFight) {
      throw new BadRequestException('Cock is already committed to another fight');
    }
  }

}
