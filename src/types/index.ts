export interface Cock {
  id: string;
  templateId: string;
  name: string;
  description?: string;
  image: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'uncommon';
  stats: {
    attack: number;
    defence: number;
    stamina: number;
    speed: number;
  };
  health: number;
  energy: number;
  wins: number;
  losses: number;
  earningsCfc: number;
  isBreeding: boolean;
  breedingEndTime?: number;
  ownerAddress: string;
  ownerUsername?: string;
  lastRestTimestamp?: number;
}

export interface Egg {
  id: string;
  image: string;
  hatchTime: number;
  isIncubating: boolean;
  incubationStartTime?: number;
  readyAt?: number;
  hatchedAt?: number;
  status: 'FRESH' | 'INCUBATING' | 'READY_TO_HATCH' | 'HATCHED';
  parentCockId?: string;
  parentChickenId?: string;
}

export interface BreedingSession {
  id: string;
  userId: string;
  cockId: string;
  chickenId: string;
  eggId?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startedAt: number;
  completesAt: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Chicken {
  id: string;
  templateId: string;
  name: string;
  description?: string;
  image: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  isBreeding: boolean;
  breedingEndTime?: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  type: 'capsule' | 'medkit';
}

export interface ShopCatalogItem {
  slug: string;
  name: string;
  description: string;
  price: number;
  type: 'capsule' | 'medkit' | 'custom';
  maxPerUser?: number;
}

export interface Pack {
  id: string;
  name: string;
  image: string;
  price: number;
  cockCount: number;
  currency: 'BNB' | 'CFC';
}

export interface FightBet {
  userId: string;
  amount: number;
  selectedCockId: string;
}

export interface FightQueue {
  id: string;
  cockId: string;
  wager: number;
  createdAt: number;
  ownerAddress: string;
  status?: 'QUEUED' | 'BETTING';
  cock?: Cock;
}

export interface SpectatorBet {
  userId: string;
  username?: string;
  cockId: string;
  amount: number;
  placedAt: number;
}

export interface ActiveFight {
  id: string;
  cock1Id: string;
  cock2Id: string;
  cock1?: Cock;
  cock2?: Cock;
  wager: number;
  status: 'betting' | 'fighting' | 'finished';
  rounds: FightRound[];
  currentRound: number;
  winnerId?: string;
  createdAt: number;
  bettingEndTime?: number;
  spectatorBets: SpectatorBet[];
  cock1Health: number;
  cock2Health: number;
  fightSeed?: number;
  roundStartTime?: number;
  fightStartTime?: number;
}

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

export interface FightRound {
  roundNumber: number;
  winnerId: string;
  cock1Damage: number;
  cock2Damage: number;
  cock1Health: number;
  cock2Health: number;
  ticks?: FightTick[];
  durationMs?: number;
}

export interface Fight {
  id: string;
  cock1: Cock;
  cock2: Cock;
  status: 'waiting' | 'betting' | 'fighting' | 'finished';
  bets: FightBet[];
  totalPot: number;
  winnerId?: string;
  startTime: number;
}

export interface User {
  walletAddress: string;
  bnbBalance: number;
  isAdmin: boolean;
  hasCompletedOnboarding?: boolean;
  username?: string;
  avatarUrl?: string;
  referredByCode?: string;
}

export interface LeaderboardEntry {
  cock: Cock;
  ownerWallet: string;
  ownerUsername?: string;
  wins: number;
  losses: number;
  earningsBnb: number;
  winRate: number;
}

export interface LeaderboardData {
  mostWins: LeaderboardEntry[];
  highestEarnings: LeaderboardEntry[];
}

export interface ReferralCode {
  code: string;
  ownerWallet: string;
  ownerUsername?: string;
  discountPercent: number;
  freeWheelSpins: number;
  earningsSharePercent: number;
  totalUses: number;
  referredWallets: string[];
  createdAt: number;
}

export interface GameState {
  user: User | null;
  cocks: Cock[];
  eggs: Egg[];
  chickens: Chicken[];
  breedingSessions: BreedingSession[];
  items: { [key: string]: number };
  fightQueue: FightQueue[];
  activeFights: ActiveFight[];
  referralCodes: ReferralCode[];
  spectatorBets: SpectatorBet[];
  shopCatalog?: ShopCatalogItem[];
  leaderboard: LeaderboardData;
}