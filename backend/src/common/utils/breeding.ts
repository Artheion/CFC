import { CockRarity } from '@prisma/client';

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const BREEDING_DURATION_MS = 24 * 60 * 60 * 1000;
export const EGG_HATCH_DURATION_MS = 48 * 60 * 60 * 1000;

const RARITY_MAX_ENERGY: Record<Rarity, number> = {
  common: 300,
  uncommon: 350,
  rare: 400,
  epic: 450,
  legendary: 500,
};

const BREEDING_PROBABILITIES: Record<string, Partial<Record<Rarity, number>>> = {
  'common-common': { common: 0.8, uncommon: 0.18, rare: 0.02 },
  'uncommon-uncommon': { common: 0.1, uncommon: 0.7, rare: 0.17, epic: 0.03 },
  'rare-rare': { common: 0.05, uncommon: 0.1, rare: 0.6, epic: 0.23, legendary: 0.02 },
  'epic-epic': { rare: 0.05, epic: 0.75, legendary: 0.2 },
  'legendary-legendary': { rare: 0.05, epic: 0.5, legendary: 0.45 },
  'common-uncommon': { common: 0.6, uncommon: 0.35, rare: 0.05 },
  'common-rare': { common: 0.4, uncommon: 0.35, rare: 0.2, epic: 0.05 },
  'common-epic': { common: 0.25, uncommon: 0.3, rare: 0.3, epic: 0.14, legendary: 0.01 },
  'common-legendary': { common: 0.15, uncommon: 0.25, rare: 0.3, epic: 0.25, legendary: 0.05 },
  'uncommon-rare': { common: 0.05, uncommon: 0.4, rare: 0.45, epic: 0.09, legendary: 0.01 },
  'uncommon-epic': { uncommon: 0.25, rare: 0.5, epic: 0.23, legendary: 0.02 },
  'uncommon-legendary': { uncommon: 0.15, rare: 0.4, epic: 0.35, legendary: 0.1 },
  'rare-epic': { uncommon: 0.02, rare: 0.35, epic: 0.55, legendary: 0.08 },
  'rare-legendary': { rare: 0.25, epic: 0.55, legendary: 0.2 },
  'epic-legendary': { rare: 0.03, epic: 0.5, legendary: 0.47 },
};

const CHICKEN_BASE_STATS: Record<Rarity, { attack: number; defence: number; stamina: number; speed: number }> = {
  common: { attack: 17, defence: 17, stamina: 17, speed: 16 },
  uncommon: { attack: 22, defence: 21, stamina: 22, speed: 21 },
  rare: { attack: 27, defence: 27, stamina: 28, speed: 26 },
  epic: { attack: 31, defence: 31, stamina: 32, speed: 30 },
  legendary: { attack: 37, defence: 37, stamina: 38, speed: 36 },
};

const orderRarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function getBreedingKey(rarityA: Rarity, rarityB: Rarity): string {
  const indexA = orderRarities.indexOf(rarityA);
  const indexB = orderRarities.indexOf(rarityB);
  if (indexA <= indexB) {
    return `${rarityA}-${rarityB}`;
  }
  return `${rarityB}-${rarityA}`;
}

export function calculateOffspringRarity(parentCockRarity: CockRarity, parentChickenRarity: string): Rarity {
  const key = getBreedingKey(parentCockRarity, parentChickenRarity as Rarity);
  const probabilities = BREEDING_PROBABILITIES[key];

  if (!probabilities) {
    return 'common';
  }

  const roll = Math.random();
  let cumulative = 0;

  for (const rarity of orderRarities) {
    const chance = probabilities[rarity];
    if (!chance) {
      continue;
    }
    cumulative += chance;
    if (roll <= cumulative) {
      return rarity;
    }
  }

  return 'common';
}

export function calculateOffspringStats(
  cockStats: { attack: number; defence: number; stamina: number; speed: number },
  chickenRarity: string,
): { attack: number; defence: number; stamina: number; speed: number } {
  const base = CHICKEN_BASE_STATS[chickenRarity as Rarity] ?? CHICKEN_BASE_STATS.common;

  const variance = () => Math.floor(Math.random() * 5) - 2;

  return {
    attack: Math.max(1, Math.floor((cockStats.attack + base.attack) / 2) + variance()),
    defence: Math.max(1, Math.floor((cockStats.defence + base.defence) / 2) + variance()),
    stamina: Math.max(1, Math.floor((cockStats.stamina + base.stamina) / 2) + variance()),
    speed: Math.max(1, Math.floor((cockStats.speed + base.speed) / 2) + variance()),
  };
}

export function calculateMaxEnergyForRarity(rarity: Rarity): number {
  return RARITY_MAX_ENERGY[rarity] ?? RARITY_MAX_ENERGY.common;
}
