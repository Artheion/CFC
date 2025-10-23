import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { PrismaService } from '@infra/prisma/prisma.service';
import { QueueService } from '@infra/queue/queue.service';
import { EscrowService } from '@infra/escrow/escrow.service';
import { JOB_QUEUE_NAMES } from '@jobs/index';
import { Cock, FightStatus, SpectatorBetStatus } from '@prisma/client';
import { 
  createSeededRandom, 
  calculateDamage, 
  calculateTurnPriority,
  type SeededRandom 
} from '@common/utils/combat-system';

interface FightJobData {
  fightId: string;
}

@Injectable()
export class FightEngineProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FightEngineProcessor.name);
  private worker?: Worker<FightJobData>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly escrowService: EscrowService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing FightEngineProcessor worker...');
    
    this.worker = new Worker<FightJobData>(
      JOB_QUEUE_NAMES.FIGHT_ENGINE,
      async (job) => {
        this.logger.log(`Processing job ${job.id} with data: ${JSON.stringify(job.data)}`);
        await this.processFight(job.data.fightId);
      },
      { connection: this.queueService.getConnection() },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Fight job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Fight job ${job?.id} failed: ${err.message}`, err.stack);
    });
    
    this.logger.log('✓ FightEngineProcessor worker initialized and listening for jobs');
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async processFight(fightId: string) {
    this.logger.log(`[FightEngine] Starting to process fight ${fightId}`);
    
    const fight = await this.prisma.fight.findUnique({
      where: { id: fightId },
      include: {
        cock1: true,
        cock2: true,
        spectatorBets: true,
      },
    });

    if (!fight || !fight.cock2) {
      this.logger.warn(`Fight ${fightId} not found or incomplete, skipping`);
      return;
    }

    const allowedStatuses: FightStatus[] = [FightStatus.BETTING, FightStatus.QUEUED];
    if (!allowedStatuses.includes(fight.status)) {
      this.logger.warn(`Fight ${fightId} is in status ${fight.status}, skipping`);
      return;
    }

    const now = new Date();
    this.logger.log(`[FightEngine] Fight ${fightId} moving to FIGHTING status and simulating`);

    // Close betting on smart contract before fight starts
    if (this.escrowService.isConfigured()) {
      try {
        await this.escrowService.closeBetting(fightId);
        this.logger.log(`✅ Betting closed on contract for fight ${fightId}`);
      } catch (error) {
        this.logger.error(`❌ Failed to close betting on contract for fight ${fightId}:`, error);
        // Continue anyway - contract has automatic betting window
      }
    }

    // Generate deterministic seed for reproducible results
    const fightSeed = this.generateFightSeed(fight.cock1.id, fight.cock2.id, fight.createdAt);
    this.logger.log(`[FightEngine] Using seed ${fightSeed} for fight simulation`);

    // Simulate the fight
    const simulation = this.simulateFight(fight.cock1, fight.cock2, fightSeed);

    // Save fight results and rounds to database
    await this.prisma.$transaction(async (tx) => {
      // Delete any existing rounds
      await tx.fightRound.deleteMany({ where: { fightId } });
      
      // Create new rounds
      await tx.fightRound.createMany({
        data: simulation.rounds.map((round) => ({
          fightId,
          roundNo: round.roundNo,
          winnerCock: round.winnerCockId,
          cock1Health: round.cock1Health,
          cock2Health: round.cock2Health,
        })),
      });

      // Update fight status to FINISHED
      await tx.fight.update({
        where: { id: fightId },
        data: {
          status: FightStatus.FINISHED,
          startedAt: now,
          settledAt: new Date(),
          winnerCockId: simulation.winnerCockId,
          metadata: {
            fightSeed,
            finalStats: simulation.finalStats,
          },
        },
      });
    });

    this.logger.log(`Fight ${fightId} finished with winner ${simulation.winnerCockId}`);

    // Update cock stats and energy
    const loserCockId = simulation.winnerCockId === fight.cock1Id ? fight.cock2Id : fight.cock1Id;
    
    if (!loserCockId) {
      this.logger.error(`Cannot determine loser for fight ${fightId}`);
      return;
    }
    
    const winnerCock = simulation.winnerCockId === fight.cock1Id ? fight.cock1 : fight.cock2!;
    const loserCock = loserCockId === fight.cock1Id ? fight.cock1 : fight.cock2!;

    await this.prisma.$transaction(async (tx) => {
      // Calculate winner earnings (wager from fight)
      const wagerAmount = parseFloat(fight.wager.toString());
      // ✅ FIX: Winner earns opponent's wager (net profit), not total pot
      // Winner gets their wager back + opponent's wager = net profit is just opponent's wager
      const netWinnings = wagerAmount; // Just the opponent's wager (net profit)
      
      // Update winner stats
      await tx.cock.update({
        where: { id: simulation.winnerCockId },
        data: {
          wins: { increment: 1 },
          earningsCfc: { increment: netWinnings },
          energy: Math.max(
            0,
            Math.min(
              winnerCock.maxEnergy,
              simulation.winnerCockId === fight.cock1Id
                ? simulation.finalStats.cock1Energy
                : simulation.finalStats.cock2Energy,
            ),
          ),
          health: Math.max(
            0,
            Math.min(
              100,
              simulation.winnerCockId === fight.cock1Id
                ? simulation.finalStats.cock1Health
                : simulation.finalStats.cock2Health,
            ),
          ),
          lastRecoveryAt: new Date(),
          energyUpdatedAt: new Date(),
          healthUpdatedAt: new Date(),
        },
      });

      // Update loser stats
      await tx.cock.update({
        where: { id: loserCockId },
        data: {
          losses: { increment: 1 },
          energy: Math.max(
            0,
            Math.min(
              loserCock.maxEnergy,
              loserCockId === fight.cock1Id
                ? simulation.finalStats.cock1Energy
                : simulation.finalStats.cock2Energy,
            ),
          ),
          health: Math.max(
            0,
            Math.min(
              100,
              loserCockId === fight.cock1Id
                ? simulation.finalStats.cock1Health
                : simulation.finalStats.cock2Health,
            ),
          ),
          lastRecoveryAt: new Date(),
          energyUpdatedAt: new Date(),
          healthUpdatedAt: new Date(),
        },
      });

      // Update spectator bets status
      if (fight.spectatorBets.length > 0) {
        await tx.spectatorBet.updateMany({
          where: {
            fightId,
            cockId: simulation.winnerCockId,
          },
          data: {
            status: SpectatorBetStatus.WON,
          },
        });

        await tx.spectatorBet.updateMany({
          where: {
            fightId,
            cockId: { not: simulation.winnerCockId },
          },
          data: {
            status: SpectatorBetStatus.LOST,
          },
        });
      }
    });

    this.logger.log(`Fight ${fightId} payouts processed successfully`);

    // Submit result to escrow contract (if configured)
    if (this.escrowService.isConfigured()) {
      try {
        // Get winner's owner wallet address
        const winnerOwner = await this.prisma.user.findUnique({
          where: { id: winnerCock.ownerId },
          select: { walletAddress: true },
        });

        if (!winnerOwner) {
          this.logger.error(`Cannot find winner owner for fight ${fightId}`);
          return;
        }

        // Convert cock rarity to contract enum
        const rarityEnum = this.escrowService.rarityToEnum(winnerCock.rarity);

        // Submit result to smart contract
        const txHash = await this.escrowService.submitResult(
          fightId,
          winnerOwner.walletAddress,
          rarityEnum
        );

        this.logger.log(`✅ Fight ${fightId} result submitted to escrow contract: ${txHash}`);
        
        // Optionally store the transaction hash in the fight record
        await this.prisma.fight.update({
          where: { id: fightId },
          data: {
            payoutSignature: txHash,
          },
        });
      } catch (error) {
        this.logger.error(`❌ Failed to submit fight ${fightId} result to escrow contract:`, error);
        // Don't fail the entire fight processing, just log the error
        // Users can still claim on-chain through other means if needed
      }
    } else {
      this.logger.warn(`⚠️  Escrow contract not configured - skipping on-chain result submission for fight ${fightId}`);
    }
  }

  private generateFightSeed(cock1Id: string, cock2Id: string, createdAt: Date): number {
    // Generate deterministic seed based on fight data
    const seedString = `${cock1Id}-${cock2Id}-${createdAt.getTime()}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      const char = seedString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private simulateFight(cock1: Cock, cock2: Cock, seed: number) {
    // Use seeded random for deterministic results (shared combat system)
    const seededRandom = createSeededRandom(seed);

    this.logger.log(`[NEW COMBAT SYSTEM] Starting fight simulation with updated combat mechanics`);
    this.logger.log(`[NEW COMBAT SYSTEM] Cock1: ${cock1.attack}/${cock1.defence}/${cock1.stamina}/${cock1.speed}`);
    this.logger.log(`[NEW COMBAT SYSTEM] Cock2: ${cock2.attack}/${cock2.defence}/${cock2.stamina}/${cock2.speed}`);

    const rounds: Array<{
      roundNo: number;
      winnerCockId: string;
      cock1Health: number;
      cock2Health: number;
    }> = [];

    let cock1Health = 100;
    let cock2Health = 100;
    let cock1Energy = cock1.energy;
    let cock2Energy = cock2.energy;
    let cock1Wins = 0;
    let cock2Wins = 0;

    // Best of 3: first to 2 wins (max 3 rounds)
    for (let roundNo = 1; roundNo <= 3; roundNo += 1) {
      // Each round starts at 100 HP for combat purposes
      let roundCock1Health = 100;
      let roundCock2Health = 100;
      
      let cock1AttackCount = 0;
      let cock2AttackCount = 0;
      let cock1LastHit = false;
      let cock2LastHit = false;
      let cock1Momentum = 0; // -3 to +3
      let cock2Momentum = 0;
      
      // Fight turn-by-turn until one reaches 0 HP
      const MAX_TURNS = 300; // Increased safety limit for slower fights
      let turnCount = 0;
      
      while (roundCock1Health > 0 && roundCock2Health > 0 && turnCount < MAX_TURNS) {
        turnCount++;
        
        // Determine turn priority using shared combat system
        const cock1Priority = calculateTurnPriority(cock1.speed, seededRandom);
        const cock2Priority = calculateTurnPriority(cock2.speed, seededRandom);
        
        if (cock1Priority >= cock2Priority) {
          // Cock1 attacks first
          if (roundCock2Health > 0) {
            const attack = calculateDamage(cock1, cock2, cock1AttackCount, seededRandom, cock1LastHit, cock1Momentum);
            
            // Log combat events for debugging
            if (attack.eventType !== 'normal') {
              this.logger.log(`[COMBAT EVENT] Round ${roundNo}: ${cock1.id.substring(0, 8)} - ${attack.eventType} (damage: ${attack.damage})`);
            }
            
            if (attack.didHit) {
              roundCock2Health = Math.max(0, roundCock2Health - attack.damage);
              cock1LastHit = true;
              cock1Momentum = Math.min(3, cock1Momentum + 1);
            } else {
              cock1LastHit = false;
              cock1Momentum = Math.max(-3, cock1Momentum - 1);
            }
            cock1AttackCount++;
          }
          
          // Cock2 attacks second (if still alive)
          if (roundCock1Health > 0 && roundCock2Health > 0) {
            const attack = calculateDamage(cock2, cock1, cock2AttackCount, seededRandom, cock2LastHit, cock2Momentum);
            if (attack.didHit) {
              roundCock1Health = Math.max(0, roundCock1Health - attack.damage);
              cock2LastHit = true;
              cock2Momentum = Math.min(3, cock2Momentum + 1);
            } else {
              cock2LastHit = false;
              cock2Momentum = Math.max(-3, cock2Momentum - 1);
            }
            cock2AttackCount++;
          }
        } else {
          // Cock2 attacks first
          if (roundCock1Health > 0) {
            const attack = calculateDamage(cock2, cock1, cock2AttackCount, seededRandom, cock2LastHit, cock2Momentum);
            if (attack.didHit) {
              roundCock1Health = Math.max(0, roundCock1Health - attack.damage);
              cock2LastHit = true;
              cock2Momentum = Math.min(3, cock2Momentum + 1);
            } else {
              cock2LastHit = false;
              cock2Momentum = Math.max(-3, cock2Momentum - 1);
            }
            cock2AttackCount++;
          }
          
          // Cock1 attacks second (if still alive)
          if (roundCock2Health > 0 && roundCock1Health > 0) {
            const attack = calculateDamage(cock1, cock2, cock1AttackCount, seededRandom, cock1LastHit, cock1Momentum);
            if (attack.didHit) {
              roundCock2Health = Math.max(0, roundCock2Health - attack.damage);
              cock1LastHit = true;
              cock1Momentum = Math.min(3, cock1Momentum + 1);
            } else {
              cock1LastHit = false;
              cock1Momentum = Math.max(-3, cock1Momentum - 1);
            }
            cock1AttackCount++;
          }
        }
      }
      
      // Determine round winner (the one still standing)
      const winnerCockId = roundCock1Health > 0 ? cock1.id : cock2.id;
      
      if (winnerCockId === cock1.id) {
        cock1Wins += 1;
        // Cock2 lost this round - deduct 10% health
        cock2Health = Math.max(0, cock2Health - 10);
      } else {
        cock2Wins += 1;
        // Cock1 lost this round - deduct 10% health
        cock1Health = Math.max(0, cock1Health - 10);
      }
      
      // Deduct energy from both cocks  
      const energyDeduction1 = Math.floor(seededRandom() * 16) + 15; // 15-30
      const energyDeduction2 = Math.floor(seededRandom() * 16) + 15; // 15-30
      cock1Energy = Math.max(0, cock1Energy - energyDeduction1);
      cock2Energy = Math.max(0, cock2Energy - energyDeduction2);

      rounds.push({
        roundNo,
        winnerCockId,
        cock1Health: roundCock1Health,
        cock2Health: roundCock2Health,
      });

      // Best of 3: first to 2 wins ends the fight
      if (cock1Wins === 2 || cock2Wins === 2) {
        break;
      }
    }

    const winnerCockId = cock1Wins === cock2Wins ? (seededRandom() > 0.5 ? cock1.id : cock2.id) : cock1Wins > cock2Wins ? cock1.id : cock2.id;

    return {
      winnerCockId,
      rounds,
      finalStats: {
        cock1Health,
        cock2Health,
        cock1Energy,
        cock2Energy,
      },
    };
  }

  // Damage calculation now uses shared combat system from @common/utils/combat-system
}
