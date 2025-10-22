import { Cock, CockRarity } from '@prisma/client';
import { computePassiveRecovery } from './cock-recovery';

const baseCock: Cock = {
  id: 'cock1',
  templateId: 'tmpl-1',
  ownerId: 'user-1',
  name: 'Thunderclaw',
  description: null,
  image: 'placeholder.png',
  rarity: CockRarity.common,
  attack: 50,
  defence: 40,
  stamina: 35,
  speed: 45,
  health: 60,
  energy: 150,
  maxEnergy: 300,
  lastRestedAt: null,
  lastRecoveryAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  healthUpdatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  energyUpdatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  wins: 0,
  losses: 0,
  isBreeding: false,
  breedingEndTime: null,
  createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
  updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
};

describe('computePassiveRecovery', () => {
  it('returns no update when interval is too short', () => {
    const cock: Cock = {
      ...baseCock,
      lastRecoveryAt: new Date(Date.now() - 60 * 1000),
    };

    const result = computePassiveRecovery(cock, new Date());
    expect(result.needsUpdate).toBe(false);
    expect(result.nextHealth).toBe(cock.health);
    expect(result.nextEnergy).toBe(cock.energy);
  });

  it('increases health and energy after sufficient time', () => {
    const cock: Cock = {
      ...baseCock,
      health: 50,
      energy: 100,
      lastRecoveryAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    };

    const result = computePassiveRecovery(cock, new Date());
    expect(result.needsUpdate).toBe(true);
    expect(result.nextHealth).toBeGreaterThan(cock.health);
    expect(result.nextEnergy).toBeGreaterThan(cock.energy);
    expect(result.nextHealth).toBeLessThanOrEqual(100);
    expect(result.nextEnergy).toBeLessThanOrEqual(cock.maxEnergy);
  });
});
