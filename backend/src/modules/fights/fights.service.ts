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
    console.log(`[FightsService] Adding fight ${fightId} to queue with 3 minute delay`);
    const job = await this.queueService
      .getQueue(JOB_QUEUE_NAMES.FIGHT_ENGINE)
      .add(
        'start-fight',
        { fightId },
        {
          jobId: fightId,
          delay: 180000, // 3 minute betting phase (180 seconds)
          removeOnComplete: false, // Keep for debugging
          removeOnFail: false,
        },
      );
    
    console.log(`[FightsService] Fight job ${job.id} added to queue, will process at ${new Date(job.timestamp + 180000).toISOString()}`);

    return updatedFight;
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
