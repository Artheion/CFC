import type {
  BackendCock,
  BackendChicken,
  BackendEgg,
  BackendInventoryItem,
  BackendReferralCode,
  BackendFight,
  BackendUser,
  BackendSpectatorBet,
  BackendCatalogItem,
  BackendBreedingSession,
  BackendLeaderboardEntry,
  BackendLeaderboardResponse,
} from './apiClient';
import type {
  ActiveFight,
  Cock,
  Chicken,
  Egg,
  FightQueue,
  ReferralCode,
  SpectatorBet,
  ShopCatalogItem,
  User,
  BreedingSession,
  LeaderboardEntry,
  LeaderboardData,
} from '../types';

const RARITY_MAP = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
} as const;

export function mapUser(user: BackendUser): User {
  // Parse bnbBalance safely - handle strings, numbers, null, undefined
  let bnbBalance = 0;
  if (typeof user.bnbBalance === 'string') {
    const parsed = parseFloat(user.bnbBalance);
    bnbBalance = isNaN(parsed) ? 0 : parsed;
  } else if (typeof user.bnbBalance === 'number') {
    bnbBalance = isNaN(user.bnbBalance) ? 0 : user.bnbBalance;
  }

  return {
    walletAddress: user.walletAddress,
    bnbBalance,
    isAdmin: user.isAdmin,
    hasCompletedOnboarding: user.hasCompletedOnboarding,
    username: user.username ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    referredByCode: user.referredByCode ?? undefined,
  };
}

export function mapCock(cock: BackendCock, ownerUsername?: string): Cock {
  const stats = {
    attack: cock.attack,
    defence: cock.defence,
    stamina: cock.stamina,
    speed: cock.speed,
  };

  const resolvedOwnerUsername = ownerUsername ?? cock.owner?.username ?? undefined;
  const ownerWallet = cock.owner?.walletAddress ?? cock.ownerId;

  return {
    id: cock.id,
    templateId: cock.templateId,
    name: cock.name,
    description: cock.description ?? undefined,
    image: cock.image,
    rarity: RARITY_MAP[cock.rarity],
    stats,
    health: cock.health,
    energy: cock.energy,
    wins: cock.wins,
    losses: cock.losses,
    earningsCfc: parseFloat(cock.earningsCfc || '0'),
    isBreeding: cock.isBreeding,
    breedingEndTime: cock.breedingEndTime ? new Date(cock.breedingEndTime).getTime() : undefined,
    ownerAddress: ownerWallet,
    ownerUsername: resolvedOwnerUsername,
    lastRestTimestamp: cock.lastRecoveryAt ? new Date(cock.lastRecoveryAt).getTime() : undefined,
  };
}

export function mapChicken(chicken: BackendChicken): Chicken {
  return {
    id: chicken.id,
    templateId: chicken.templateId,
    name: chicken.name,
    description: chicken.description ?? undefined,
    image: chicken.image,
    rarity: RARITY_MAP[chicken.rarity],
    isBreeding: chicken.isBreeding,
    breedingEndTime: chicken.breedingEndTime ? new Date(chicken.breedingEndTime).getTime() : undefined,
  };
}

export function mapEgg(egg: BackendEgg): Egg {
  return {
    id: egg.id,
    image: egg.image,
    hatchTime: egg.hatchTimeMs,
    isIncubating: egg.isIncubating,
    incubationStartTime: egg.incubationStart ? new Date(egg.incubationStart).getTime() : undefined,
    readyAt: egg.readyAt ? new Date(egg.readyAt).getTime() : undefined,
    hatchedAt: egg.hatchedAt ? new Date(egg.hatchedAt).getTime() : undefined,
    status: egg.status,
    parentCockId: egg.parentCockId ?? undefined,
    parentChickenId: egg.parentChickenId ?? undefined,
  };
}

export function mapInventory(items: BackendInventoryItem[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.itemCatalog.slug] = item.quantity;
    return acc;
  }, {});
}

export function mapShopCatalog(items: BackendCatalogItem[]): ShopCatalogItem[] {
  return items.map((item) => {
    const price = parseFloat(item.priceCfc || '0');
    return {
      slug: item.slug,
      name: item.name,
      description: item.description,
      price,
      type: item.type === 'MEDKIT' ? 'medkit' : item.type === 'CAPSULE' ? 'capsule' : 'custom',
      maxPerUser: typeof item.maxPerUser === 'number' ? item.maxPerUser : undefined,
    };
  });
}

export function mapBreedingSessions(sessions: BackendBreedingSession[]): BreedingSession[] {
  return sessions.map((session) => ({
    id: session.id,
    userId: session.userId,
    cockId: session.cockId,
    chickenId: session.chickenId,
    eggId: session.eggId ?? undefined,
    status: session.status,
    startedAt: new Date(session.startedAt).getTime(),
    completesAt: new Date(session.completesAt).getTime(),
    completedAt: session.completedAt ? new Date(session.completedAt).getTime() : undefined,
    createdAt: new Date(session.createdAt).getTime(),
    updatedAt: new Date(session.updatedAt).getTime(),
  }));
}

function mapReferralCodeEntry(code: BackendReferralCode): ReferralCode {
  return {
    code: code.code,
    ownerWallet: code.ownerWallet,
    ownerUsername: code.ownerUsername ?? undefined,
    discountPercent: code.discountPercent,
    freeWheelSpins: code.freeWheelSpins,
    earningsSharePercent: code.earningsSharePercent,
    totalUses: code.totalUses,
    referredWallets: code.joins?.map((join) => join.joinedWallet) ?? [],
    createdAt: new Date(code.createdAt).getTime(),
  };
}

export function mapReferralCode(code: BackendReferralCode | null): ReferralCode[] {
  if (!code) {
    return [];
  }

  return [mapReferralCodeEntry(code)];
}

export function mapReferralCodes(codes: BackendReferralCode[]): ReferralCode[] {
  return codes.map(mapReferralCodeEntry);
}

export function mapFightQueue(fights: BackendFight[]): FightQueue[] {
  return fights
    .filter((fight) => fight.status === 'QUEUED' || fight.status === 'BETTING')
    .map((fight) => ({
      id: fight.id,
      cockId: fight.cock1Id,
      wager: parseFloat(fight.wager),
      createdAt: new Date(fight.createdAt).getTime(),
      ownerAddress: fight.cock1?.owner?.walletAddress ?? fight.cock1.ownerId,
      status: fight.status,
      cock: fight.cock1
        ? mapCock(fight.cock1, fight.cock1.owner?.username ?? undefined)
        : undefined,
    }));
}

export function mapActiveFight(fight: BackendFight): ActiveFight {
  const spectatorBets: SpectatorBet[] = fight.spectatorBets
    ? fight.spectatorBets.map((bet) => ({
        userId: bet.user?.walletAddress ?? bet.userId,
        cockId: bet.cockId,
        amount: parseFloat(bet.amount),
        placedAt: new Date(bet.placedAt).getTime(),
      }))
    : [];
  
  // Extract metadata fields
  const metadata = fight.metadata as any;
  const bettingEndTime = metadata?.bettingEndTime;
  const fightSeed = metadata?.fightSeed;
  
  return {
    id: fight.id,
    cock1Id: fight.cock1Id,
    cock2Id: fight.cock2Id ?? '',
    cock1: fight.cock1
      ? mapCock(fight.cock1, fight.cock1.owner?.username ?? undefined)
      : undefined,
    cock2: fight.cock2
      ? mapCock(fight.cock2, fight.cock2.owner?.username ?? undefined)
      : undefined,
    wager: parseFloat(fight.wager),
    status: fight.status === 'BETTING' ? 'betting' 
          : fight.status === 'FIGHTING' ? 'fighting'
          : fight.status === 'FINISHED' ? 'finished' 
          : 'fighting',
    rounds:
      fight.rounds?.map((round) => ({
        roundNumber: round.roundNo,
        winnerId: round.winnerCock ?? '',
        cock1Damage: 0,
        cock2Damage: 0,
        cock1Health: round.cock1Health,
        cock2Health: round.cock2Health,
      })) ?? [],
    currentRound: fight.rounds?.length ?? 0,
    winnerId: fight.winnerCockId ?? undefined,
    createdAt: new Date(fight.createdAt).getTime(),
    spectatorBets,
    cock1Health: fight.rounds?.at(-1)?.cock1Health ?? 100,
    cock2Health: fight.rounds?.at(-1)?.cock2Health ?? 100,
    bettingEndTime,
    fightSeed,
    metadata: fight.metadata,
  };
}

export function mapFightHistory(fights: BackendFight[]): ActiveFight[] {
  return fights.map((fight) => mapActiveFight(fight));
}

export function mapSpectatorBets(bets: BackendSpectatorBet[]): SpectatorBet[] {
  return bets.map((bet) => ({
    userId: bet.user?.walletAddress ?? bet.userId,
    username: bet.user?.username ?? undefined,
    cockId: bet.cockId,
    amount: parseFloat(bet.amount),
    placedAt: new Date(bet.placedAt).getTime(),
  }));
}

function mapLeaderboardEntry(entry: BackendLeaderboardEntry): LeaderboardEntry {
  const earningsValue = typeof entry.earningsBnb === 'string' ? Number.parseFloat(entry.earningsBnb) : entry.earningsBnb ?? 0;
  const winRateValue = typeof entry.winRate === 'number' ? entry.winRate : Number(entry.winRate) || 0;

  return {
    cock: mapCock(entry.cock, entry.ownerUsername ?? undefined),
    ownerWallet: entry.ownerWallet,
    ownerUsername: entry.ownerUsername ?? undefined,
    wins: entry.wins,
    losses: entry.losses,
    earningsBnb: Number.isFinite(earningsValue) ? earningsValue : 0,
    winRate: Number.isFinite(winRateValue) ? winRateValue : 0,
  };
}

export function mapLeaderboard(response: BackendLeaderboardResponse | null): LeaderboardData {
  if (!response) {
    return { mostWins: [], highestEarnings: [] };
  }

  return {
    mostWins: response.mostWins.map(mapLeaderboardEntry),
    highestEarnings: response.highestEarnings.map(mapLeaderboardEntry),
  };
}
