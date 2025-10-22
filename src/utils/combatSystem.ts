import { Cock } from '../types';

const RARITY_MAX_ENERGY: Record<Cock['rarity'], number> = {
  common: 300,
  uncommon: 350,
  rare: 400,
  epic: 450,
  legendary: 500,
};

/**
 * Combat System Utilities
 * Based on the design spec from combat mechanism.txt
 */

// ==================== SEEDED RANDOM GENERATOR ====================

/**
 * Type for seeded random function
 */
export type SeededRandom = () => number;

/**
 * Create a seeded random generator (same algorithm as backend)
 * Returns values between 0 and 1
 */
export const createSeededRandom = (initialSeed: number): SeededRandom => {
  let seed = initialSeed;
  
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
};

// ==================== ENERGY SYSTEM ====================

/**
 * Calculate maximum energy for a cock based on stamina
 */
export const calculateMaxEnergy = (_stamina: number, rarity: Cock['rarity'] = 'common'): number => {
  const base = RARITY_MAX_ENERGY[rarity] ?? 300;
  return base;
};

/**
 * Calculate energy cost for a fight
 */
export const calculateEnergyCost = (roundsFought: number, stamina: number): number => {
  const baseCost = 50;
  const roundCost = roundsFought * 2;
  const staminaReduction = 1 - (stamina / 200);
  
  const totalEnergyCost = (baseCost + roundCost) * staminaReduction;
  
  return Math.round(totalEnergyCost);
};

interface EnergyStats {
  currentEnergy: number;
  maxEnergy: number;
  energyPercent: number;
}

/**
 * Normalize and clamp a cock's energy and provide helper stats
 */
export const getEnergyStats = (cock: Cock): EnergyStats => {
  const maxEnergy = calculateMaxEnergy(cock.stats.stamina, cock.rarity);
  const rawEnergy = typeof cock.energy === 'number' && Number.isFinite(cock.energy)
    ? cock.energy
    : maxEnergy;

  const currentEnergy = Math.min(maxEnergy, Math.max(0, rawEnergy));
  const energyPercent = maxEnergy === 0 ? 0 : (currentEnergy / maxEnergy) * 100;

  return {
    currentEnergy,
    maxEnergy,
    energyPercent,
  };
};

/**
 * Ensure a cock's stored energy stays within valid bounds
 */
export const ensureEnergyWithinBounds = (cock: Cock): Cock => {
  const { currentEnergy } = getEnergyStats(cock);
  return {
    ...cock,
    energy: currentEnergy,
  };
};

/**
 * Calculate natural energy recovery per hour
 */
export const calculateEnergyRecovery = (stamina: number): number => {
  return 10 + (stamina / 5);
};

/**
 * Apply energy recovery based on time passed
 */
export const applyEnergyRecovery = (currentEnergy: number, stamina: number, hoursPassed: number, rarity: Cock['rarity'] = 'common'): number => {
  const maxEnergy = calculateMaxEnergy(stamina, rarity);
  const recoveryRate = calculateEnergyRecovery(stamina);
  const totalRecovery = recoveryRate * hoursPassed;
  
  return Math.min(maxEnergy, currentEnergy + totalRecovery);
};

// ==================== COMBAT CALCULATIONS ====================

/**
 * Calculate average level of a cock based on all stats
 */
export const calculateCockLevel = (cock: Cock): number => {
  return Math.round((cock.stats.attack + cock.stats.defence + cock.stats.stamina + cock.stats.speed) / 4);
};

/**
 * Apply diminishing returns for close-level matchups
 * Reduces stat gap to make fights more competitive
 */
const applyDiminishingReturns = (attackerStat: number, defenderStat: number, attackerLevel: number, defenderLevel: number): { attackerNormalized: number; defenderNormalized: number } => {
  const levelDiff = Math.abs(attackerLevel - defenderLevel);
  
  // If within 5 levels, compress stat differences
  if (levelDiff <= 5) {
    const compressionFactor = 0.6; // Reduces effective stat gap by 40%
    const avgStat = (attackerStat + defenderStat) / 2;
    
    return {
      attackerNormalized: avgStat + (attackerStat - avgStat) * compressionFactor,
      defenderNormalized: avgStat + (defenderStat - avgStat) * compressionFactor
    };
  }
  
  // Normal stats for large level gaps
  return {
    attackerNormalized: attackerStat,
    defenderNormalized: defenderStat
  };
};

/**
 * Check if an attack hits (now more consistent, not speed-based)
 */
export const checkHit = (random: SeededRandom = Math.random): boolean => {
  const baseHitChance = 0.85; // 85% base hit rate
  return random() <= baseHitChance;
};

/**
 * Check if an attack is a critical hit (speed-based)
 */
export const checkCritical = (attackerSpeed: number, random: SeededRandom = Math.random): boolean => {
  const critChance = Math.min(0.35, (attackerSpeed / 600) + 0.08);
  return random() <= critChance;
};

/**
 * Calculate fatigue multiplier based on stamina and time elapsed
 * Lower stamina = more fatigue over time
 */
export const calculateFatigueMultiplier = (stamina: number, attackCount: number): number => {
  // Stamina reduces fatigue rate
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
 */
export const calculateDamage = (
  attacker: Cock, 
  defender: Cock, 
  attackCount: number = 0,
  random: SeededRandom = Math.random,
  lastAttackHit: boolean = false,
  momentum: number = 0
): CombatResult => {
  // Check for dodge (speed-based, 3-6% chance)
  const dodgeChance = 0.03 + (defender.stats.speed / 1500);
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
  if (attacker.stats.stamina < 30 && random() <= 0.15) {
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
    if (defender.stats.speed > attacker.stats.speed + 5 && random() <= 0.20) {
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
  
  // Apply stat normalization for close matches
  const { attackerNormalized: normalizedAttack, defenderNormalized: normalizedDefence } = 
    applyDiminishingReturns(attacker.stats.attack, defender.stats.defence, attackerLevel, defenderLevel);
  
  // Base damage calculation (REDUCED by 40% for longer, more dramatic fights)
  const baseDamage = (normalizedAttack * 0.12) - (normalizedDefence * 0.108);
  const minimumDamage = Math.max(0.5, normalizedAttack * 0.01);
  
  // Increased variance (±40% instead of ±20%) for less predictable fights
  const varianceFactor = 0.6 + (random() * 0.8); // 0.6 to 1.4
  
  // Critical hit check with variety
  const isCrit = checkCritical(attacker.stats.speed, random);
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
  const blockChance = 0.05 + (defender.stats.defence / 1000);
  if (random() <= blockChance) {
    critMultiplier *= 0.5; // 50% damage reduction
    eventType = 'block';
    isBlock = true;
  }
  
  // Stamina-based fatigue (damage decreases as fight goes on for low stamina)
  const fatigueMultiplier = calculateFatigueMultiplier(attacker.stats.stamina, attackCount);
  
  // Momentum bonus (±15% at max)
  const momentumMultiplier = 1 + (momentum * 0.05);
  
  // Final damage calculation
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
    applyDiminishingReturns(attacker.stats.attack, defender.stats.defence, attackerLevel, defenderLevel);
  
  const baseDamage = (normalizedAttack * 0.12) - (normalizedDefence * 0.108);
  const minimumDamage = Math.max(0.5, normalizedAttack * 0.01);
  const varianceFactor = 0.6 + (random() * 0.8);
  
  return Math.max(minimumDamage, baseDamage * varianceFactor);
}

/**
 * Determine turn priority for combat with increased randomness
 */
export const calculateTurnPriority = (speed: number, random: SeededRandom = Math.random): number => {
  // Increased random range for more turn order variance
  return speed + (random() * 40 - 20); // ±20 instead of ±5
};
