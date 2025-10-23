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
  private gateway: any; // Will be injected via setter

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly escrowService: EscrowService,
  ) {}

  /**
   * Setter injection for FightsGateway to avoid circular dependency
   * Called from FightsModule after both services are instantiated
   */
  setGateway(gateway: any) {
    this.gateway = gateway;
    this.logger.log('✅ FightsGateway injected into FightEngineProcessor');
  }

  async onModuleInit() {
    this.logger.log('🔧 Initializing FightEngineProcessor worker...');
    
    try {
      // Test Redis connection first
      const connection = this.queueService.getConnection();
      await connection.ping();
      this.logger.log('✅ Redis connection successful');
    } catch (error) {
      this.logger.error('❌ Redis connection failed! Jobs will not process.', error);
      this.logger.error('   Make sure REDIS_URL is set correctly in your .env file');
      throw error;
    }
    
    this.worker = new Worker<FightJobData>(
      JOB_QUEUE_NAMES.FIGHT_ENGINE,
      async (job) => {
        this.logger.log(`⚔️  Processing fight job ${job.id} with data: ${JSON.stringify(job.data)}`);
        this.logger.log(`⚔️  Fight ID: ${job.data.fightId}`);
        try {
          await this.processFight(job.data.fightId);
          this.logger.log(`✅ Fight job ${job.id} completed successfully`);
        } catch (error) {
          this.logger.error(`❌ Fight job ${job.id} processing error:`, error);
          throw error;
        }
      },
      { 
        connection: this.queueService.getConnection(),
        concurrency: 1, // Process one fight at a time
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`✅ Fight job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`❌ Fight job ${job?.id} failed: ${err.message}`, err.stack);
    });

    this.worker.on('error', (err) => {
      this.logger.error(`❌ Worker error: ${err.message}`, err.stack);
    });

    this.worker.on('active', (job) => {
      this.logger.log(`🎮 Fight job ${job.id} is now active (processing fight ${job.data.fightId})`);
    });
    
    this.logger.log('✅ FightEngineProcessor worker initialized and listening for jobs');
    this.logger.log(`📊 Worker concurrency: 1`);
    this.logger.log(`🔊 Worker ready to process ${JOB_QUEUE_NAMES.FIGHT_ENGINE} jobs`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  /**
   * Process fight in REAL-TIME with sequential rounds
   * ✅ Best Practice: Server-authoritative with client synchronization
   */
  private async processFight(fightId: string) {
    this.logger.log(`[FightEngine] 🎮 Starting REAL-TIME fight processing: ${fightId}`);
    this.logger.log(`[FightEngine] ⏰ Current time: ${new Date().toISOString()}`);
    
    const fight = await this.prisma.fight.findUnique({
      where: { id: fightId },
      include: {
        cock1: true,
        cock2: true,
        spectatorBets: true,
      },
    });

    if (!fight) {
      this.logger.error(`[FightEngine] ❌ Fight ${fightId} not found in database!`);
      return;
    }

    if (!fight.cock2) {
      this.logger.warn(`[FightEngine] ⚠️  Fight ${fightId} incomplete - cock2 not set. Skipping.`);
      return;
    }

    // Only process fights in BETTING status (not QUEUED - those haven't been joined yet)
    if (fight.status !== FightStatus.BETTING) {
      this.logger.warn(`[FightEngine] ⚠️  Fight ${fightId} is in status ${fight.status}, not BETTING. Skipping.`);
      return;
    }

    this.logger.log(`[FightEngine] ✅ Fight validated - proceeding with processing`);
    this.logger.log(`[FightEngine] 🥊 Cock1: ${fight.cock1.name} (${fight.cock1.id})`);
    this.logger.log(`[FightEngine] 🥊 Cock2: ${fight.cock2.name} (${fight.cock2.id})`);
    this.logger.log(`[FightEngine] 💰 Wager: ${fight.wager} $CFC`);
    this.logger.log(`[FightEngine] 👥 Spectator bets: ${fight.spectatorBets.length}`);

    const now = new Date();
    
    // Close betting on smart contract before fight starts
    if (this.escrowService.isConfigured()) {
      try {
        await this.escrowService.closeBetting(fightId);
        this.logger.log(`✅ Betting closed on contract for fight ${fightId}`);
      } catch (error) {
        this.logger.error(`❌ Failed to close betting on contract for fight ${fightId}:`, error);
      }
    }

    // Generate deterministic seed for reproducible results
    const fightSeed = this.generateFightSeed(fight.cock1.id, fight.cock2.id, fight.createdAt);
    this.logger.log(`[FightEngine] Using seed ${fightSeed} for fight simulation`);

    // Mark fight as FIGHTING (not FINISHED yet!)
    await this.prisma.fight.update({
      where: { id: fightId },
      data: {
        status: FightStatus.FIGHTING,
        startedAt: now,
        metadata: {
          fightSeed,
        },
      },
    });

    // ✅ BROADCAST: Fight is starting
    if (this.gateway) {
      this.logger.log(`[FightEngine] 📡 Broadcasting fight-starting event via WebSocket`);
      this.gateway.emitFightStarting(fightId, {
        cock1Id: fight.cock1.id,
        cock2Id: fight.cock2.id,
        fightSeed,
      });
    } else {
      this.logger.error(`[FightEngine] ❌ Gateway not injected! Cannot broadcast WebSocket events!`);
      this.logger.error(`[FightEngine]    Make sure FightsModule.onModuleInit() is calling setGateway()`);
    }

    try {
      // Process rounds sequentially in REAL-TIME
      await this.processRoundsSequentially(fightId, fight.cock1, fight.cock2, fightSeed);
    } catch (error) {
      this.logger.error(`Error processing fight ${fightId}:`, error);
      
      if (this.gateway) {
        this.gateway.emitFightError(fightId, { message: 'Fight processing error', code: 'FIGHT_ERROR' });
      }
      
      // Mark fight as cancelled or errored
      await this.prisma.fight.update({
        where: { id: fightId },
        data: { status: FightStatus.CANCELLED },
      });
    }
  }

  /**
   * Process rounds one by one with delays for animation
   * ✅ Real-time synchronization: All clients see rounds at the same time
   */
  private async processRoundsSequentially(fightId: string, cock1: Cock, cock2: Cock, seed: number) {
    const seededRandom = createSeededRandom(seed);
    
    let cock1Health = 100;
    let cock2Health = 100;
    let cock1RoundWins = 0;
    let cock2RoundWins = 0;
    let roundNumber = 1;
    const rounds: any[] = [];

    this.logger.log(`[FightEngine] 🥊 Starting Best-of-3 rounds for fight ${fightId}`);

    // Best of 3: First to 2 wins
    while (cock1RoundWins < 2 && cock2RoundWins < 2 && roundNumber <= 3) {
      this.logger.log(`[FightEngine] ⚔️  Processing Round ${roundNumber}`);

      // ✅ BROADCAST: Round starting
      if (this.gateway) {
        this.gateway.emitRoundStart(fightId, { roundNumber });
      }

      // Wait 3 seconds for countdown animation
      await this.delay(3000);

      // Simulate this round
      const roundResult = this.simulateRound(cock1, cock2, cock1Health, cock2Health, seededRandom);
      
      cock1Health = roundResult.cock1Health;
      cock2Health = roundResult.cock2Health;
      
      const roundWinnerId = cock1Health > cock2Health ? cock1.id : cock2.id;
      
      if (roundWinnerId === cock1.id) {
        cock1RoundWins++;
      } else {
        cock2RoundWins++;
      }

      const roundData = {
        roundNo: roundNumber,
        winnerCockId: roundWinnerId,
        cock1Health,
        cock2Health,
      };

      rounds.push(roundData);

      // Save round to database immediately
      await this.prisma.fightRound.create({
        data: {
          fightId,
          ...roundData,
        },
      });

      // ✅ BROADCAST: Round complete - ALL clients animate this simultaneously
      if (this.gateway) {
        this.gateway.emitRoundComplete(fightId, {
          roundNumber,
          winnerId: roundWinnerId,
          cock1Health,
          cock2Health,
          cock1Damage: 100 - cock1Health,
          cock2Damage: 100 - cock2Health,
        });
      }

      this.logger.log(`[FightEngine] ✅ Round ${roundNumber} complete - Winner: ${roundWinnerId} (${cock1RoundWins}-${cock2RoundWins})`);

      // Wait 25 seconds for frontend animation to complete
      await this.delay(25000);

      // Reset health for next round (unless fight is over)
      if (cock1RoundWins < 2 && cock2RoundWins < 2) {
        cock1Health = 100;
        cock2Health = 100;
        roundNumber++;
      }
    }

    // Determine overall winner
    const overallWinnerId = cock1RoundWins > cock2RoundWins ? cock1.id : cock2.id;

    this.logger.log(`[FightEngine] 🏆 Fight complete! Winner: ${overallWinnerId} (${cock1RoundWins}-${cock2RoundWins})`);

    // ✅ BROADCAST: Fight finished
    if (this.gateway) {
      this.gateway.emitFightFinished(fightId, {
        winnerId: overallWinnerId,
        cock1RoundWins,
        cock2RoundWins,
        totalRounds: rounds.length,
      });
    }

    // Wait 3 seconds for celebration animation
    await this.delay(3000);

    // NOW mark as finished and credit winner
    await this.finalizeFight(fightId, overallWinnerId, cock1, cock2, rounds);
  }

  /**
   * Finalize fight: Mark as FINISHED, update stats, credit winner
   */
  private async finalizeFight(fightId: string, winnerId: string, cock1: Cock, cock2: Cock, rounds: any[]) {
    this.logger.log(`[FightEngine] 💰 Finalizing fight ${fightId} - Crediting winner ${winnerId}`);

    const fight = await this.prisma.fight.findUnique({
      where: { id: fightId },
      include: { spectatorBets: true },
    });

    if (!fight) return;

    const loserCockId = winnerId === cock1.id ? cock2.id : cock1.id;
    
    const winnerCock = winnerId === cock1.id ? cock1 : cock2;
    const loserCock = loserCockId === cock1.id ? cock1 : cock2;

    await this.prisma.$transaction(async (tx) => {
      // Calculate winner earnings (wager from fight)
      const wagerAmount = parseFloat(fight.wager.toString());
      // ✅ FIX: Winner earns opponent's wager (net profit), not total pot
      const netWinnings = wagerAmount; // Just the opponent's wager (net profit)
      
      // Calculate energy/health loss based on rounds fought
      const numRounds = rounds.length;
      const energyCost = Math.min(winnerCock.energy, numRounds * 10); // 10 energy per round
      const healthCost = Math.min(winnerCock.health, numRounds * 5); // 5 health per round
      
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

      // Update loser stats (more energy/health loss)
      const loserEnergyCost = Math.min(loserCock.energy, numRounds * 15); // 15 energy per round (loser loses more)
      const loserHealthCost = Math.min(loserCock.health, numRounds * 10); // 10 health per round
      
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

      // Update spectator bets status
      if (fight.spectatorBets.length > 0) {
        await tx.spectatorBet.updateMany({
          where: {
            fightId,
            cockId: winnerId,
          },
          data: {
            status: SpectatorBetStatus.WON,
          },
        });

        await tx.spectatorBet.updateMany({
          where: {
            fightId,
            cockId: { not: winnerId },
          },
          data: {
            status: SpectatorBetStatus.LOST,
          },
        });
      }

      // ✅ NOW mark fight as FINISHED in database
      await tx.fight.update({
        where: { id: fightId },
        data: {
          status: FightStatus.FINISHED,
          settledAt: new Date(),
          winnerCockId: winnerId,
        },
      });
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

  /**
   * Helper: Delay execution for animation synchronization
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Simulate a single round
   */
  private simulateRound(
    cock1: Cock,
    cock2: Cock,
    initialCock1Health: number,
    initialCock2Health: number,
    seededRandom: SeededRandom,
  ): { cock1Health: number; cock2Health: number } {
    let cock1Health = initialCock1Health;
    let cock2Health = initialCock2Health;

    // Battle for 10 turns or until one reaches 0 HP
    for (let turn = 1; turn <= 10; turn++) {
      const turnPriority = calculateTurnPriority(cock1.speed, seededRandom);
      
      if (turnPriority === 1) {
        // Cock1 attacks
        const damageResult = calculateDamage(cock1, cock2, 0, seededRandom);
        cock2Health = Math.max(0, cock2Health - damageResult.damage);
        
        if (cock2Health <= 0) break;
        
        // Cock2 counter-attacks
        const counterDamageResult = calculateDamage(cock2, cock1, 0, seededRandom);
        cock1Health = Math.max(0, cock1Health - counterDamageResult.damage);
        
        if (cock1Health <= 0) break;
      } else {
        // Cock2 attacks
        const damageResult = calculateDamage(cock2, cock1, 0, seededRandom);
        cock1Health = Math.max(0, cock1Health - damageResult.damage);
        
        if (cock1Health <= 0) break;
        
        // Cock1 counter-attacks
        const counterDamageResult = calculateDamage(cock1, cock2, 0, seededRandom);
        cock2Health = Math.max(0, cock2Health - counterDamageResult.damage);
        
        if (cock2Health <= 0) break;
      }
    }

    return { cock1Health, cock2Health };
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
