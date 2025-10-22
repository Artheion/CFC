import { Cock, FightRound } from '../types';
import { calculateDamage, calculateTurnPriority, createSeededRandom, SeededRandom } from './combatSystem';

export interface FightTick {
  tick: number;
  cock1Health: number;
  cock2Health: number;
  lastAction?: {
    attacker: string;
    defender: string;
    damage: number;
    didHit: boolean;
    isCrit: boolean;
  };
}

export interface RoundResult {
  winnerId: string;
  cock1Damage: number;
  cock2Damage: number;
  cock1Health: number;
  cock2Health: number;
  ticks: FightTick[];
  durationMs: number;
}

// Constants for fight timing
export const FACING_DURATION = 5000; // 5 seconds facing before fight
export const TICK_INTERVAL = 500; // Damage every 500ms
export const ROUND_DELAY = 3000; // 3 seconds between rounds

export function simulateRound(
  cock1: Cock,
  cock2: Cock,
  roundNumber: number,
  seed: number
): RoundResult {
  const seededRandom = createSeededRandom(seed + roundNumber);
  
  let currentCock1Health = 100;
  let currentCock2Health = 100;
  let cock1AttackCount = 0;
  let cock2AttackCount = 0;
  let totalCock1Damage = 0;
  let totalCock2Damage = 0;
  
  const ticks: FightTick[] = [];
  
  // Determine turn priority with seeded random
  const cock1Priority = calculateTurnPriority(cock1.stats.speed, seededRandom);
  const cock2Priority = calculateTurnPriority(cock2.stats.speed, seededRandom);
  
  let tickCount = 0;
  const MAX_TICKS = 100; // Safety limit
  
  while (currentCock1Health > 0 && currentCock2Health > 0 && tickCount < MAX_TICKS) {
    tickCount++;
    
    let tickData: FightTick = {
      tick: tickCount,
      cock1Health: currentCock1Health,
      cock2Health: currentCock2Health,
    };
    
    // Determine who attacks first based on priority
    if (cock1Priority > cock2Priority) {
      // Cock 1 attacks first
      const attack1 = calculateDamage(cock1, cock2, cock1AttackCount, seededRandom);
      if (attack1.didHit) {
        const damage = attack1.damage;
        currentCock2Health = Math.max(0, currentCock2Health - damage);
        totalCock1Damage += damage;
        tickData.lastAction = {
          attacker: cock1.id,
          defender: cock2.id,
          damage,
          didHit: true,
          isCrit: attack1.isCrit,
        };
      }
      cock1AttackCount++;
      
      // Cock 2 attacks second (if still alive)
      if (currentCock2Health > 0) {
        const attack2 = calculateDamage(cock2, cock1, cock2AttackCount, seededRandom);
        if (attack2.didHit) {
          const damage = attack2.damage;
          currentCock1Health = Math.max(0, currentCock1Health - damage);
          totalCock2Damage += damage;
          if (!tickData.lastAction) {
            tickData.lastAction = {
              attacker: cock2.id,
              defender: cock1.id,
              damage,
              didHit: true,
              isCrit: attack2.isCrit,
            };
          }
        }
        cock2AttackCount++;
      }
    } else {
      // Cock 2 attacks first
      const attack2 = calculateDamage(cock2, cock1, cock2AttackCount, seededRandom);
      if (attack2.didHit) {
        const damage = attack2.damage;
        currentCock1Health = Math.max(0, currentCock1Health - damage);
        totalCock2Damage += damage;
        tickData.lastAction = {
          attacker: cock2.id,
          defender: cock1.id,
          damage,
          didHit: true,
          isCrit: attack2.isCrit,
        };
      }
      cock2AttackCount++;
      
      // Cock 1 attacks second (if still alive)
      if (currentCock1Health > 0) {
        const attack1 = calculateDamage(cock1, cock2, cock1AttackCount, seededRandom);
        if (attack1.didHit) {
          const damage = attack1.damage;
          currentCock2Health = Math.max(0, currentCock2Health - damage);
          totalCock1Damage += damage;
          if (!tickData.lastAction) {
            tickData.lastAction = {
              attacker: cock1.id,
              defender: cock2.id,
              damage,
              didHit: true,
              isCrit: attack1.isCrit,
            };
          }
        }
        cock1AttackCount++;
      }
    }
    
    tickData.cock1Health = currentCock1Health;
    tickData.cock2Health = currentCock2Health;
    ticks.push(tickData);
  }
  
  const winnerId = currentCock1Health > currentCock2Health ? cock1.id : cock2.id;
  const durationMs = tickCount * TICK_INTERVAL;
  
  return {
    winnerId,
    cock1Damage: totalCock1Damage,
    cock2Damage: totalCock2Damage,
    cock1Health: currentCock1Health,
    cock2Health: currentCock2Health,
    ticks,
    durationMs,
  };
}

export function calculateFightPhase(fight: {
  status: string;
  bettingEndTime?: number;
  fightStartTime?: number;
  rounds: FightRound[];
  winnerId?: string;
}): {
  phase: 'betting' | 'facing' | 'round1' | 'delay1' | 'round2' | 'delay2' | 'round3' | 'finished';
  roundNumber?: number;
  progress?: number;
  countdown?: number;
} {
  const now = Date.now();
  
  // Finished state - only check status, not winnerId (winner is pre-calculated but we still want to show the fight)
  if (fight.status === 'finished') {
    return { phase: 'finished' };
  }
  
  // Betting phase
  if (fight.status === 'betting') {
    if (!fight.bettingEndTime || now < fight.bettingEndTime) {
      const remaining = fight.bettingEndTime ? Math.max(0, fight.bettingEndTime - now) : 0;
      return { phase: 'betting', countdown: Math.ceil(remaining / 1000) };
    }
  }
  
  // Fight hasn't started yet
  if (!fight.fightStartTime) {
    return { phase: 'betting' };
  }
  
  // Facing phase (5 seconds before round 1)
  if (now < fight.fightStartTime) {
    const countdown = Math.ceil((fight.fightStartTime - now) / 1000);
    return { phase: 'facing', countdown, roundNumber: 1 };
  }
  
  // Calculate which round based on elapsed time
  const elapsed = now - fight.fightStartTime;
  
  // Each round: ROUND_DURATION + ROUND_DELAY
  // For now, estimate ~10 seconds per round of fighting
  const ROUND_DURATION = 10000;
  
  // Round 1: 0 - 10s
  if (elapsed < ROUND_DURATION) {
    const progress = (elapsed / ROUND_DURATION) * 100;
    return { phase: 'round1', roundNumber: 1, progress };
  }
  
  // Delay after round 1: 10s - 13s
  if (elapsed < ROUND_DURATION + ROUND_DELAY) {
    return { phase: 'delay1', roundNumber: 1 };
  }
  
  // Round 2: 13s - 23s
  if (elapsed < ROUND_DURATION * 2 + ROUND_DELAY) {
    const roundElapsed = elapsed - (ROUND_DURATION + ROUND_DELAY);
    const progress = (roundElapsed / ROUND_DURATION) * 100;
    return { phase: 'round2', roundNumber: 2, progress };
  }
  
  // Delay after round 2: 23s - 26s
  if (elapsed < ROUND_DURATION * 2 + ROUND_DELAY * 2) {
    return { phase: 'delay2', roundNumber: 2 };
  }
  
  // Round 3: 26s - 36s
  if (elapsed < ROUND_DURATION * 3 + ROUND_DELAY * 2) {
    const roundElapsed = elapsed - (ROUND_DURATION * 2 + ROUND_DELAY * 2);
    const progress = (roundElapsed / ROUND_DURATION) * 100;
    return { phase: 'round3', roundNumber: 3, progress };
  }
  
  // Fight should be finished by now
  return { phase: 'finished' };
}
