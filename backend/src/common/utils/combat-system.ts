/**
 * Shared Combat System
 * MUST match frontend src/utils/combatSystem.ts exactly
 * Any changes here must be reflected in frontend!
 */

import { Cock } from '@prisma/client';

// ==================== SEEDED RANDOM GENERATOR ====================

export type SeededRandom = () => number;

/**
 * Create a seeded random generator
 * IMPORTANT: Must use same algorithm as frontend!
 */
export const createSeededRandom = (initialSeed: number): SeededRandom => {
  let seed = initialSeed;
  
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
};

// ==================== COMBAT CALCULATIONS ====================

/**
 * Calculate average level of a cock based on all stats
 */
export const calculateCockLevel = (cock: Cock): number => {
  return Math.round((cock.attack + cock.defence + cock.stamina + cock.speed) / 4);
};

/**
 * Apply diminishing returns for close-level matchups
 */
const applyDiminishingReturns = (
  attackerStat: number, 
  defenderStat: number, 
  attackerLevel: number, 
  defenderLevel: number
): { attackerNormalized: number; defenderNormalized: number } => {
  const levelDiff = Math.abs(attackerLevel - defenderLevel);
  
  if (levelDiff <= 5) {
    const compressionFactor = 0.6;
    const avgStat = (attackerStat + defenderStat) / 2;
    
    return {
      attackerNormalized: avgStat + (attackerStat - avgStat) * compressionFactor,
      defenderNormalized: avgStat + (defenderStat - avgStat) * compressionFactor
    };
  }
  
  return {
    attackerNormalized: attackerStat,
    defenderNormalized: defenderStat
  };
};

/**
 * Check if an attack hits
 */
export const checkHit = (random: SeededRandom): boolean => {
  const baseHitChance = 0.85; // 85% base hit rate
  return random() <= baseHitChance;
};

/**
 * Check if an attack is a critical hit (speed-based)
 */
export const checkCritical = (attackerSpeed: number, random: SeededRandom): boolean => {
  const critChance = Math.min(0.35, (attackerSpeed / 600) + 0.08);
  return random() <= critChance;
};

/**
 * Calculate fatigue multiplier based on stamina and attack count
 */
export const calculateFatigueMultiplier = (stamina: number, attackCount: number): number => {
  const fatigueRate = Math.max(0.001, 0.01 - (stamina / 10000));
  const fatigue = Math.max(0.85, 1.0 - (fatigueRate * attackCount));
  return fatigue;
};

/**
 * Combat event types for dynamic combat
 */
export type CombatEventType = 'normal' | 'dodge' | 'block' | 'combo' | 'counter' | 'critical' | 'mega_critical' | 'exhausted';

export interface CombatResult {
  damage: number;
  isCrit: boolean;
  didHit: boolean;
  eventType: CombatEventType;
  isDodge?: boolean;
  isBlock?: boolean;
  isCombo?: boolean;
  isCounter?: boolean;
  critMultiplier?: number;
}

/**
 * Calculate damage for one attack with dynamic combat events
 * MUST match frontend calculation exactly!
 */
export const calculateDamage = (
  attacker: Cock, 
  defender: Cock, 
  attackCount: number,
  random: SeededRandom,
  lastAttackHit: boolean = false,
  momentum: number = 0
): CombatResult => {
  // Check for dodge (speed-based, 3-6% chance)
  const dodgeChance = 0.03 + (defender.speed / 1500);
  if (random() <= dodgeChance) {
    return { 
      damage: 0, 
      isCrit: false, 
      didHit: false, 
      eventType: 'dodge',
      isDodge: true 
    };
  }

  // Check for exhaustion (low stamina penalty, 15% chance)
  if (attacker.stamina < 30 && random() <= 0.15) {
    return { 
      damage: 0, 
      isCrit: false, 
      didHit: false, 
      eventType: 'exhausted' 
    };
  }

  // Check if attack hits
  const didHit = checkHit(random);
  if (!didHit) {
    // Check for counter-attack (high speed defender, 20% chance)
    if (defender.speed > attacker.speed + 5 && random() <= 0.20) {
      // Counter-attack deals reduced damage
      const counterDamage = Math.floor(
        calculateBaseDamage(defender, attacker, random) * 0.7
      );
      return { 
        damage: counterDamage, 
        isCrit: false, 
        didHit: true, 
        eventType: 'counter',
        isCounter: true 
      };
    }
    return { damage: 0, isCrit: false, didHit: false, eventType: 'normal' };
  }
  
  // Calculate levels for diminishing returns
  const attackerLevel = calculateCockLevel(attacker);
  const defenderLevel = calculateCockLevel(defender);
  
  // Apply stat normalization
  const { attackerNormalized: normalizedAttack, defenderNormalized: normalizedDefence } = 
    applyDiminishingReturns(attacker.attack, defender.defence, attackerLevel, defenderLevel);
  
  // Base damage calculation (REDUCED by 40% for longer, more dramatic fights)
  const baseDamage = (normalizedAttack * 0.12) - (normalizedDefence * 0.108);
  const minimumDamage = Math.max(0.5, normalizedAttack * 0.01);
  
  // Increased variance (±40% instead of ±20%) for less predictable fights
  const varianceFactor = 0.6 + (random() * 0.8); // 0.6 to 1.4
  
  // Critical hit check with variety
  const isCrit = checkCritical(attacker.speed, random);
  let critMultiplier = 1.0;
  let eventType: CombatEventType = 'normal';
  
  if (isCrit) {
    const critRoll = random();
    if (critRoll <= 0.70) {
      // Normal crit (70% of crits)
      critMultiplier = 1.5;
      eventType = 'critical';
    } else if (critRoll <= 0.95) {
      // Devastating crit (25% of crits)
      critMultiplier = 1.8;
      eventType = 'critical';
    } else {
      // Mega crit (5% of crits)
      critMultiplier = 2.5;
      eventType = 'mega_critical';
    }
  }
  
  // Check for combo (consecutive hit bonus, 15% chance)
  let isCombo = false;
  if (lastAttackHit && random() <= 0.15) {
    critMultiplier *= 1.3; // 30% bonus damage
    eventType = 'combo';
    isCombo = true;
  }
  
  // Check for block (defence-based, 5-9% chance)
  let isBlock = false;
  const blockChance = 0.05 + (defender.defence / 1000);
  if (random() <= blockChance) {
    critMultiplier *= 0.5; // 50% damage reduction
    eventType = 'block';
    isBlock = true;
  }
  
  // Stamina-based fatigue
  const fatigueMultiplier = calculateFatigueMultiplier(attacker.stamina, attackCount);
  
  // Momentum bonus (±15% at max)
  const momentumMultiplier = 1 + (momentum * 0.05);
  
  // Final damage
  let finalDamage = baseDamage * varianceFactor * critMultiplier * fatigueMultiplier * momentumMultiplier;
  finalDamage = Math.max(minimumDamage, finalDamage);
  
  // Round to 1 decimal place for smoother display
  finalDamage = Math.round(finalDamage * 10) / 10;
  
  return { 
    damage: finalDamage, 
    isCrit: isCrit && !isCombo && !isBlock, 
    didHit: true, 
    eventType,
    isCombo,
    isBlock,
    critMultiplier: isCrit ? critMultiplier : undefined
  };
};

/**
 * Helper function to calculate base damage (used for counters)
 */
function calculateBaseDamage(attacker: Cock, defender: Cock, random: SeededRandom): number {
  const attackerLevel = calculateCockLevel(attacker);
  const defenderLevel = calculateCockLevel(defender);
  
  const { attackerNormalized: normalizedAttack, defenderNormalized: normalizedDefence } = 
    applyDiminishingReturns(attacker.attack, defender.defence, attackerLevel, defenderLevel);
  
  const baseDamage = (normalizedAttack * 0.12) - (normalizedDefence * 0.108);
  const minimumDamage = Math.max(0.5, normalizedAttack * 0.01);
  const varianceFactor = 0.6 + (random() * 0.8);
  
  return Math.max(minimumDamage, baseDamage * varianceFactor);
}

/**
 * Determine turn priority for combat
 */
export const calculateTurnPriority = (speed: number, random: SeededRandom): number => {
  return speed + (random() * 40 - 20); // ±20 variance
};
