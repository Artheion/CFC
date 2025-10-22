import { Cock } from '@prisma/client';

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const MINIMUM_RECOVERY_INTERVAL_MS = 5 * 60 * 1000;
const HEALTH_RECOVERY_PERCENT_PER_HOUR = 15; // 15% per hour (~7 hours for full recovery)
const ENERGY_RECOVERY_PERCENT_PER_HOUR = 20; // 20% per hour (~5 hours for full recovery)

export function computePassiveRecovery(cock: Cock, now = new Date()) {
  const lastRecoveryAt = cock.lastRecoveryAt ?? cock.energyUpdatedAt ?? cock.updatedAt ?? cock.createdAt;
  const elapsedMs = now.getTime() - lastRecoveryAt.getTime();

  if (elapsedMs < MINIMUM_RECOVERY_INTERVAL_MS) {
    return {
      needsUpdate: false,
      nextHealth: cock.health,
      nextEnergy: cock.energy,
    };
  }

  const hoursElapsed = elapsedMs / MILLISECONDS_PER_HOUR;
  if (hoursElapsed <= 0) {
    return {
      needsUpdate: false,
      nextHealth: cock.health,
      nextEnergy: cock.energy,
    };
  }

  const healthGain = Math.floor((HEALTH_RECOVERY_PERCENT_PER_HOUR / 100) * 100 * hoursElapsed);
  const energyGain = Math.floor((ENERGY_RECOVERY_PERCENT_PER_HOUR / 100) * cock.maxEnergy * hoursElapsed);

  const nextHealth = Math.min(100, cock.health + Math.max(healthGain, 0));
  const nextEnergy = Math.min(cock.maxEnergy, cock.energy + Math.max(energyGain, 0));

  return {
    needsUpdate: nextHealth !== cock.health || nextEnergy !== cock.energy,
    nextHealth,
    nextEnergy,
  };
}
