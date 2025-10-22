import { Cock, Chicken } from '../types';

// Breeding rarity probability table (balanced for difficulty)
const BREEDING_PROBABILITIES: Record<string, Record<string, number>> = {
  // Same rarity breeding
  'common-common': { common: 0.80, uncommon: 0.18, rare: 0.02, epic: 0, legendary: 0 },
  'uncommon-uncommon': { common: 0.10, uncommon: 0.70, rare: 0.17, epic: 0.03, legendary: 0 },
  'rare-rare': { common: 0.05, uncommon: 0.10, rare: 0.60, epic: 0.23, legendary: 0.02 },
  'epic-epic': { common: 0, uncommon: 0, rare: 0.05, epic: 0.75, legendary: 0.20 },
  'legendary-legendary': { common: 0, uncommon: 0, rare: 0.05, epic: 0.50, legendary: 0.45 }, // Not guaranteed!
  
  // Mixed rarity breeding (harder outcomes)
  'common-uncommon': { common: 0.60, uncommon: 0.35, rare: 0.05, epic: 0, legendary: 0 },
  'common-rare': { common: 0.40, uncommon: 0.35, rare: 0.20, epic: 0.05, legendary: 0 },
  'common-epic': { common: 0.25, uncommon: 0.30, rare: 0.30, epic: 0.14, legendary: 0.01 },
  'common-legendary': { common: 0.15, uncommon: 0.25, rare: 0.30, epic: 0.25, legendary: 0.05 },
  
  'uncommon-rare': { common: 0.05, uncommon: 0.40, rare: 0.45, epic: 0.09, legendary: 0.01 },
  'uncommon-epic': { common: 0, uncommon: 0.25, rare: 0.50, epic: 0.23, legendary: 0.02 },
  'uncommon-legendary': { common: 0, uncommon: 0.15, rare: 0.40, epic: 0.35, legendary: 0.10 },
  
  'rare-epic': { common: 0, uncommon: 0.02, rare: 0.35, epic: 0.55, legendary: 0.08 },
  'rare-legendary': { common: 0, uncommon: 0, rare: 0.25, epic: 0.55, legendary: 0.20 },
  
  'epic-legendary': { common: 0, uncommon: 0, rare: 0.03, epic: 0.50, legendary: 0.47 },
};

// Get breeding key from parent rarities (order doesn't matter)
function getBreedingKey(rarity1: string, rarity2: string): string {
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const index1 = rarities.indexOf(rarity1);
  const index2 = rarities.indexOf(rarity2);
  
  // Ensure consistent ordering (lower rarity first)
  if (index1 <= index2) {
    return `${rarity1}-${rarity2}`;
  } else {
    return `${rarity2}-${rarity1}`;
  }
}

// Calculate offspring rarity based on parent rarities
export function calculateOffspringRarity(cockRarity: Cock['rarity'], chickenRarity: Chicken['rarity']): Cock['rarity'] {
  const breedingKey = getBreedingKey(cockRarity, chickenRarity);
  const probabilities = BREEDING_PROBABILITIES[breedingKey];
  
  if (!probabilities) {
    console.warn(`No breeding probabilities found for ${breedingKey}, defaulting to common`);
    return 'common';
  }
  
  // Generate random number between 0 and 1
  const roll = Math.random();
  let cumulative = 0;
  
  // Roll against cumulative probabilities
  for (const [rarity, probability] of Object.entries(probabilities)) {
    cumulative += probability;
    if (roll <= cumulative) {
      return rarity as Cock['rarity'];
    }
  }
  
  // Fallback (should never reach here if probabilities sum to 1)
  return 'common';
}

// Generate base stats for a chicken based on rarity (chickens don't have stats property)
// Chicken stats are percentage of cock base stats for same rarity
function getChickenBaseStats(rarity: string): { attack: number; defence: number; stamina: number; speed: number } {
  const baseStatsByRarity: Record<string, { attack: number; defence: number; stamina: number; speed: number }> = {
    // Common cocks avg: 22-25 → Chickens @ 70% = ~16-17
    common: { attack: 17, defence: 17, stamina: 17, speed: 16 },
    
    // Uncommon cocks avg: 27-30 → Chickens @ 75% = ~20-22
    uncommon: { attack: 22, defence: 21, stamina: 22, speed: 21 },
    
    // Rare cocks avg: 32-35 → Chickens @ 80% = ~26-28
    rare: { attack: 27, defence: 27, stamina: 28, speed: 26 },
    
    // Epic cocks avg: 37-40 → Chickens @ 80% = ~30-32
    epic: { attack: 31, defence: 31, stamina: 32, speed: 30 },
    
    // Legendary cocks avg: 42-45 → Chickens @ 85% = ~36-38
    legendary: { attack: 37, defence: 37, stamina: 38, speed: 36 },
  };
  
  return baseStatsByRarity[rarity] || baseStatsByRarity.common;
}

// Calculate offspring stats based on parent stats
export function calculateOffspringStats(
  cockStats: Cock['stats'],
  chickenRarity: string
): Cock['stats'] {
  // Get chicken base stats from rarity
  const chickenStats = getChickenBaseStats(chickenRarity);
  
  // Average parent stats and add small random variance (-2 to +2)
  const variance = () => Math.floor(Math.random() * 5) - 2; // -2, -1, 0, 1, 2
  
  return {
    attack: Math.max(1, Math.floor((cockStats.attack + chickenStats.attack) / 2) + variance()),
    defence: Math.max(1, Math.floor((cockStats.defence + chickenStats.defence) / 2) + variance()),
    stamina: Math.max(1, Math.floor((cockStats.stamina + chickenStats.stamina) / 2) + variance()),
    speed: Math.max(1, Math.floor((cockStats.speed + chickenStats.speed) / 2) + variance()),
  };
}
