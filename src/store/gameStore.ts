import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Cock,
  Egg,
  Chicken,
  GameState,
  User,
  FightQueue,
  ActiveFight,
  FightRound,
  SpectatorBet,
  ReferralCode,
  ShopCatalogItem,
  BreedingSession,
} from '../types';

import type {
  BackendUser,
  BackendCock,
  BackendChicken,
  BackendEgg,
  BackendInventoryItem,
  BackendReferralCode,
  BackendFight,
  BackendSpectatorBet,
  BackendCatalogItem,
  BackendWheelSpin,
  BackendBreedingSession,
  BackendLeaderboardResponse,
} from '../utils/apiClient';
import {
  clearTokens,
  fetchProfile,
  fetchCocks,
  fetchChickens,
  fetchEggs,
  fetchInventory,
  fetchReferrals,
  fetchAdminReferralCodes,
  fetchFightQueue,
  fetchActiveFights,
  fetchFightHistory,
  fetchFightDetails,
  updateProfile as updateProfileRequest,
  updateCockProfileRequest,
  triggerCockRecoveryRequest,
  updateChickenProfileRequest,
  startIncubation,
  hatchEgg,
  useInventoryItem,
  createFightRequest,
  joinFightRequest,
  cancelFightRequest,
  placeBetRequest,
  listBets,
  listShopCatalog,
  buyItemRequest,
  spinWheelRequest,
  applyReferralCodeRequest,
  updateReferralCodeSettings,
  updatePricesRequest,
  startBreedingRequest,
  processBreedingSessions,
  listActiveBreedingSessions,
  fetchLeaderboard,
} from '../utils/apiClient';
import {
  mapUser,
  mapCock,
  mapChicken,
  mapEgg,
  mapInventory,
  mapReferralCode,
  mapReferralCodes,
  mapFightQueue,
  mapFightHistory,
  mapShopCatalog,
  mapSpectatorBets,
  mapBreedingSessions,
  mapLeaderboard,
} from '../utils/backendMappers';
import {
  calculateEnergyCost,
  calculateMaxEnergy,
  ensureEnergyWithinBounds,
  getEnergyStats,
} from '../utils/combatSystem';
import { getRandomCockByRarity } from '../data/cocks';
import { getRandomChickenByRarity } from '../data/chickens';

const FIXED_STATS = {
  attack: 40,
  defence: 40,
  stamina: 40,
  speed: 40,
} as const;

const withFixedStats = (cock: Cock): Cock => ({
  ...cock,
  stats: { ...FIXED_STATS },
});

const normalizeReferralCode = (code: string): string => code.trim().toUpperCase();

const generateUniqueReferralCode = (walletAddress: string, existingCodes: ReferralCode[]): string => {
  const prefix = 'CFC';
  const walletSegment = walletAddress.slice(0, 4).toUpperCase();
  let attempt = 0;

  while (attempt < 25) {
    const randomSegment = Math.random().toString(36).replace(/[^a-z0-9]/gi, '').toUpperCase();
    const segment = `${randomSegment}${Date.now().toString(36).toUpperCase()}`.replace(/[^A-Z0-9]/g, '');
    const codeBody = segment.slice(0, 6).padEnd(6, 'X');
    const candidate = `${prefix}-${walletSegment}-${codeBody.slice(0, 3)}${codeBody.slice(3)}`;

    if (!existingCodes.some((existing) => existing.code === candidate)) {
      return candidate;
    }

    attempt += 1;
  }

  const fallback = `${prefix}-${walletSegment}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  return fallback;
};

const ONE_HOUR_MS = 60 * 60 * 1000;
const HEALTH_RECOVERY_PER_HOUR = 15; // percent points per hour
const ENERGY_RECOVERY_RATE_PER_HOUR = 0.2; // 20% of max energy per hour
const BREEDING_DURATION_MS = 24 * 60 * 60 * 1000;
const EGG_HATCH_DURATION_MS = 48 * 60 * 60 * 1000;

const applyRestingRecoveryToCock = (cock: Cock, now: number): Cock => {
  if (!cock.lastRestTimestamp) {
    return ensureEnergyWithinBounds({ ...cock, lastRestTimestamp: now });
  }

  const elapsedMs = now - cock.lastRestTimestamp;
  if (elapsedMs <= 0) {
    return cock;
  }

  const hoursElapsed = elapsedMs / ONE_HOUR_MS;
  if (hoursElapsed <= 0) {
    return cock;
  }

  const healthGain = HEALTH_RECOVERY_PER_HOUR * hoursElapsed;
  const stamina = cock.stats?.stamina ?? FIXED_STATS.stamina;
  const maxEnergy = calculateMaxEnergy(stamina, cock.rarity);
  const energyGain = maxEnergy * ENERGY_RECOVERY_RATE_PER_HOUR * hoursElapsed;

  const currentHealth = Number.isFinite(cock.health) ? cock.health : 0;
  const currentEnergy = Number.isFinite(cock.energy) ? cock.energy : 0;

  const nextHealth = Math.min(100, currentHealth + healthGain);
  const nextEnergy = Math.min(maxEnergy, currentEnergy + energyGain);

  const roundedHealth = parseFloat(nextHealth.toFixed(2));
  const roundedEnergy = parseFloat(nextEnergy.toFixed(2));

  const healthChanged = Math.abs(roundedHealth - currentHealth) >= 0.01;
  const energyChanged = Math.abs(roundedEnergy - currentEnergy) >= 0.01;

  if (!healthChanged && !energyChanged) {
    return cock;
  }

  return ensureEnergyWithinBounds({
    ...cock,
    health: roundedHealth,
    energy: roundedEnergy,
    lastRestTimestamp: now,
  });
};

export const BACKEND_ENABLED = Boolean(import.meta.env.VITE_API_BASE_URL);

type HydrationPayload = {
  user: BackendUser;
  cocks: BackendCock[];
  chickens: BackendChicken[];
  eggs: BackendEgg[];
  inventory: BackendInventoryItem[];
  referral: BackendReferralCode | null;
  fights: BackendFight[];
  adminReferrals?: BackendReferralCode[];
  active: BackendFight[];
  history: BackendFight[];
  bets: BackendSpectatorBet[];
  catalog: BackendCatalogItem[];
  breedingSessions: BackendBreedingSession[];
  leaderboard: BackendLeaderboardResponse | null;
};

const getDefaultState = () => ({
  user: null as User | null,
  cocks: [] as Cock[],
  eggs: [] as Egg[],
  chickens: [] as Chicken[],
  breedingSessions: [] as BreedingSession[],
  items: {} as Record<string, number>,
  fightQueue: [] as FightQueue[],
  activeFights: [] as ActiveFight[],
  referralCodes: [] as ReferralCode[],
  spectatorBets: [] as SpectatorBet[],
  shopCatalog: [] as ShopCatalogItem[],
  leaderboard: { mostWins: [], highestEarnings: [] },
  loading: false,
  isHydrated: false,
  // Add cache timestamps to prevent excessive refetching
  lastFetchTimestamps: {
    fights: 0,
    shop: 0,
    leaderboard: 0,
  } as Record<string, number>,
});

interface GameStore extends GameState {
  loading: boolean;
  isHydrated: boolean;
  setLoading: (loading: boolean) => void;
  hydrateFromBackend: (payload: HydrationPayload) => void;
  logout: () => void;
  refreshBackendState: () => Promise<void>;
  loadFightsData: () => Promise<void>;
  loadShopData: () => Promise<void>;
  loadLeaderboardData: () => Promise<void>;
  setUser: (user: User | null) => void;
  updateProfileInfo: (updates: { username?: string; avatarUrl?: string | null; hasCompletedOnboarding?: boolean }) => Promise<void>;
  addCock: (cock: Cock) => void;
  updateCock: (id: string, updates: Partial<Cock>) => Promise<void>;
  removeCock: (id: string) => void;
  addEgg: (egg: Egg) => void;
  updateEgg: (id: string, updates: Partial<Egg>) => Promise<void>;
  removeEgg: (id: string) => void;
  startEggIncubation: (eggId: string) => Promise<void>;
  hatchEggAction: (eggId: string) => Promise<Cock | null>;
  addChicken: (chicken: Chicken) => void;
  updateChicken: (id: string, updates: Partial<Chicken>) => Promise<void>;
  addItem: (itemId: string, quantity: number) => void;
  useItem: (itemId: string, cockId: string) => Promise<boolean>;
  updateBNBBalance: (amount: number) => void;
  startBreeding: (cockId: string, chickenId: string) => Promise<boolean>;
  checkBreedingComplete: () => Promise<void>;
  createFight: (cockId: string, wager: number, paymentSignature?: string | null, fightId?: string) => Promise<boolean | FightQueue>;
  joinFight: (fightQueueId: string, cockId: string, paymentSignature?: string) => Promise<string | null>;
  removeFightFromQueue: (fightQueueId: string) => Promise<void>;
  getFightById: (fightId: string) => ActiveFight | undefined;
  placeBet: (fightId: string, cockId: string, amount: number, paymentSignature?: string) => Promise<boolean>;
  updateFightById: (fightId: string, updates: Partial<ActiveFight>) => void;
  loadSpectatorBets: () => Promise<void>;
  loadShopCatalog: () => Promise<void>;
  loadLeaderboard: () => Promise<void>;
  buyShopItem: (itemSlug: string, quantity: number, paymentSignature?: string) => Promise<boolean>;
  rollRoulette: (wheelType?: string, paymentTxHash?: string) => Promise<{
    success: boolean;
    cock?: Cock;
    chicken?: Chicken;
    reward?: string;
    rewardType?: string;
    rewardRarity?: string | null;
    error?: string;
  }>;
  refreshRestingCocks: () => void;
  addReferralCode: (code: ReferralCode) => void;
  updateReferralCode: (code: string, updates: Partial<ReferralCode>) => Promise<void>;
  applyReferralCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  updatePrices: (payload: { rouletteCost?: number; capsulePrice?: number; medkitPrice?: number }) => Promise<void>;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...getDefaultState(),

      setLoading: (loading) => set({ loading }),

      hydrateFromBackend: (payload: HydrationPayload) => {
        const mappedUser = mapUser(payload.user);
        const mappedCocks = payload.cocks.map((cock) =>
          mapCock(cock, payload.user.username ?? undefined),
        );
        const mappedChickens = payload.chickens.map(mapChicken);
        const mappedEggs = payload.eggs.map(mapEgg);
        const mappedInventory = mapInventory(payload.inventory);
        const mappedUserReferrals = mapReferralCode(payload.referral);
        const mappedAdminReferrals = payload.adminReferrals ? mapReferralCodes(payload.adminReferrals) : [];
        const referralMap = new Map<string, ReferralCode>();
        mappedUserReferrals.forEach((entry) => referralMap.set(entry.code, entry));
        mappedAdminReferrals.forEach((entry) => referralMap.set(entry.code, entry));
        const mergedReferrals = Array.from(referralMap.values());
        const mappedQueue = mapFightQueue(payload.fights);
        const mappedActive = mapFightHistory(payload.active ?? []);
        const mappedHistory = mapFightHistory(payload.history ?? []);
        const combinedFights = [...mappedActive, ...mappedHistory].sort((a, b) => b.createdAt - a.createdAt);
        const mappedBets = mapSpectatorBets(payload.bets);
        const mappedCatalog = mapShopCatalog(payload.catalog);
        const mappedBreedingSessions = mapBreedingSessions(payload.breedingSessions ?? []);
        const mappedLeaderboard = mapLeaderboard(payload.leaderboard ?? null);

        set({
          user: mappedUser,
          cocks: mappedCocks,
          chickens: mappedChickens,
          eggs: mappedEggs,
          breedingSessions: mappedBreedingSessions,
          items: mappedInventory,
          referralCodes: mergedReferrals,
          fightQueue: mappedQueue,
          activeFights: combinedFights,
          spectatorBets: mappedBets,
          shopCatalog: mappedCatalog,
          leaderboard: mappedLeaderboard,
          loading: false,
          isHydrated: true,
        });
      },

      loadSpectatorBets: async () => {
        if (!BACKEND_ENABLED) {
          return;
        }

        try {
          const bets = await listBets();
          set({ spectatorBets: mapSpectatorBets(bets) });
        } catch (error) {
          console.error('Failed to load spectator bets', error);
        }
      },

      loadShopCatalog: async () => {
        if (!BACKEND_ENABLED) {
          return;
        }

        try {
          const catalog = await listShopCatalog();
          set({ shopCatalog: mapShopCatalog(catalog) });
        } catch (error) {
          console.error('Failed to load shop catalog', error);
        }
      },

      loadLeaderboard: async () => {
        if (BACKEND_ENABLED) {
          try {
            const response = await fetchLeaderboard();
            set({ leaderboard: mapLeaderboard(response) });
          } catch (error) {
            console.error('Failed to load leaderboard', error);
          }
          return;
        }

        const state = get();
        if (!state.cocks.length) {
          set({ leaderboard: { mostWins: [], highestEarnings: [] } });
          return;
        }

        const computeEntries = (source: Cock[]) =>
          source.slice(0, 20).map((cock) => ({
            cock,
            ownerWallet: cock.ownerAddress,
            ownerUsername: cock.ownerUsername,
            wins: cock.wins,
            losses: cock.losses,
            earningsBnb: cock.earningsCfc,
            winRate: cock.wins + cock.losses > 0 ? cock.wins / (cock.wins + cock.losses) : 0,
          }));

        const sortedByWins = [...state.cocks].sort((a, b) => {
          if (b.wins !== a.wins) {
            return b.wins - a.wins;
          }
          return a.losses - b.losses;
        });

        const sortedByEarnings = [...state.cocks].sort((a, b) => {
          const earningsA = a.earningsCfc;
          const earningsB = b.earningsCfc;
          if (earningsB !== earningsA) {
            return earningsB - earningsA;
          }
          return b.wins - a.wins;
        });

        set({
          leaderboard: {
            mostWins: computeEntries(sortedByWins),
            highestEarnings: computeEntries(sortedByEarnings),
          },
        });
      },

      buyShopItem: async (itemSlug, quantity, paymentSignature?) => {
        if (BACKEND_ENABLED) {
          try {
            await buyItemRequest({ itemSlug, quantity, paymentSignature });
            // Only refresh inventory, not everything
            const inventory = await fetchInventory();
            set({ items: mapInventory(inventory) });
            return true;
          } catch (error) {
            console.error('Failed to buy item via backend', error);
            return false;
          }
        }

        get().addItem(itemSlug, quantity);
        return true;
      },

      logout: () => {
        clearTokens();
        // Don't clear wallet-specific onboarding flags - they're per address
        set(getDefaultState());
      },

      refreshBackendState: async () => {
        if (!BACKEND_ENABLED) {
          return;
        }

        const state = get();
        if (!state.user) {
          return;
        }

        // ✅ PERFORMANCE: Cache API calls to prevent excessive refreshes
        const now = Date.now();
        const REFRESH_CACHE_DURATION = 30000; // 30 seconds (increased from 5s for better performance)
        const lastRefresh = state.lastFetchTimestamps.coreRefresh || 0;
        
        if (now - lastRefresh < REFRESH_CACHE_DURATION) {
          console.log('[Store] Skipping refresh - cached data is fresh');
          return; // Skip if refreshed recently
        }

        try {
          set({ loading: true });
          const profile = await fetchProfile();

          if (!profile) {
            throw new Error('Unable to load profile from backend');
          }

          // ✅ PERFORMANCE: Fetch core data in parallel (fastest approach)
          const [
            cocks,
            chickens,
            eggs,
            inventory,
            referral,
            breedingSessions,
            adminReferrals,
          ] = await Promise.all([
            fetchCocks(),
            fetchChickens(),
            fetchEggs(),
            fetchInventory(),
            fetchReferrals().catch(() => null),
            listActiveBreedingSessions().catch(() => []),
            profile.isAdmin ? fetchAdminReferralCodes().catch(() => []) : Promise.resolve([]),
          ]);

          // Fights and leaderboard are loaded on-demand in their respective pages
          // Don't fetch them here to reduce API calls
          get().hydrateFromBackend({
            user: profile,
            cocks,
            chickens,
            eggs,
            inventory,
            referral,
            fights: [], // Empty array - loaded on-demand in Arena page
            adminReferrals,
            active: [], // Empty array - loaded on-demand in Arena/Spectate pages
            history: [], // Empty array - loaded on-demand
            breedingSessions,
            bets: [], // Empty array - loaded on-demand in Spectate page
            catalog: [], // Empty array - loaded on-demand in Shop page
            leaderboard: null, // Null - loaded on-demand in Leaderboard page
          });
          
          // Update cache timestamp
          set(state => ({
            lastFetchTimestamps: { ...state.lastFetchTimestamps, coreRefresh: now }
          }));
        } catch (error) {
          console.error('Failed to refresh backend state', error);
          
          // If authentication error, clear tokens and reset state
          if (error instanceof Error) {
            const message = error.message.toLowerCase();
            if (message.includes('unauthorized') || message.includes('401') || message.includes('token')) {
              console.warn('Authentication failed, clearing session');
              clearTokens();
              // Don't clear wallet-specific onboarding flags
              set(getDefaultState());
              return;
            }
          }
          
          set({ loading: false });
        }
      },

  setUser: (incomingUser) => {
    if (!incomingUser) {
      set(getDefaultState());
      return;
    }

    if (BACKEND_ENABLED) {
      set((state) => ({
        user: {
          ...(state.user ?? {}),
          ...incomingUser,
        },
      }));
      return;
    }

    const refreshRest = get().refreshRestingCocks;
    refreshRest();

    set((state) => {
      const previous = state.user;
      const mergedUser: User = {
        ...previous,
        ...incomingUser,
        username: incomingUser.username ?? previous?.username,
        referredByCode: incomingUser.referredByCode ?? previous?.referredByCode,
      };

      return { user: mergedUser };
    });

    const currentUser = get().user;
    if (!currentUser) {
      return;
    }

    set((state) => {
      const { referralCodes } = state;
      const existing = referralCodes.find((code) => code.ownerWallet === currentUser.walletAddress);

      if (existing) {
        if (existing.ownerUsername !== currentUser.username) {
          return {
            referralCodes: referralCodes.map((code) =>
              code.code === existing.code ? { ...code, ownerUsername: currentUser.username } : code
            ),
          };
        }
        return state;
      }

      const newCodeValue = generateUniqueReferralCode(currentUser.walletAddress, referralCodes);
      const newCode: ReferralCode = {
        code: newCodeValue,
        ownerWallet: currentUser.walletAddress,
        ownerUsername: currentUser.username,
        discountPercent: 0,
        freeWheelSpins: 0,
        earningsSharePercent: 5,
        totalUses: 0,
        referredWallets: [],
        createdAt: Date.now(),
      };

      return {
        referralCodes: [...referralCodes, newCode],
      };
    });
  },

  updateProfileInfo: async (updates) => {
    if (BACKEND_ENABLED) {
      const payload: { username?: string; avatarUrl?: string | null; hasCompletedOnboarding?: boolean } = {};

      if (updates.username !== undefined) {
        payload.username = updates.username;
      }

      if (updates.avatarUrl !== undefined) {
        payload.avatarUrl = updates.avatarUrl ?? '';
      }

      if (updates.hasCompletedOnboarding !== undefined) {
        payload.hasCompletedOnboarding = updates.hasCompletedOnboarding;
      }

      if (Object.keys(payload).length === 0) {
        console.warn('No profile fields provided for update');
        return;
      }

      try {
        await updateProfileRequest(payload);
        // Only refresh profile, not everything
        const profile = await fetchProfile();
        if (profile) {
          set({ user: mapUser(profile) });
        }
      } catch (error) {
        console.error('Failed to update profile via backend', error);
        throw error;
      }

      return;
    }

    set((state) => {
      if (!state.user) {
        return state;
      }

      const nextUser: User = {
        ...state.user,
        ...(updates.username !== undefined ? { username: updates.username || undefined } : {}),
        ...(updates.avatarUrl !== undefined ? { avatarUrl: updates.avatarUrl || undefined } : {}),
      };

      const nextReferralCodes = updates.username !== undefined
        ? state.referralCodes.map((code) =>
            code.ownerWallet === state.user?.walletAddress
              ? { ...code, ownerUsername: updates.username || undefined }
              : code,
          )
        : state.referralCodes;

      const nextCocks = updates.username !== undefined
        ? state.cocks.map((cock) =>
            cock.ownerAddress === state.user?.walletAddress
              ? { ...cock, ownerUsername: updates.username || undefined }
              : cock,
          )
        : state.cocks;

      return {
        user: nextUser,
        referralCodes: nextReferralCodes,
        cocks: nextCocks,
      };
    });
  },

  addCock: (cock) =>
    set((state) => ({
      cocks: [
        ...state.cocks,
        ensureEnergyWithinBounds(
          withFixedStats({
            ...cock,
            lastRestTimestamp: cock.lastRestTimestamp ?? Date.now(),
          })
        ),
      ],
    })),

  updateCock: async (id, updates) => {
    if (BACKEND_ENABLED) {
      const payload: { name?: string; description?: string } = {};
      if (typeof updates.name === 'string') {
        payload.name = updates.name;
      }
      if (typeof updates.description === 'string') {
        payload.description = updates.description;
      }

      if (Object.keys(payload).length === 0) {
        console.warn('Attempted to update cock fields without backend support; ignoring');
        return;
      }

      try {
        await updateCockProfileRequest(id, payload);
        // Only refresh cocks, not everything
        const cocks = await fetchCocks();
        const state = get();
        set({ cocks: cocks.map((cock) => mapCock(cock, state.user?.username)) });
      } catch (error) {
        console.error('Failed to update cock via backend', error);
        throw error;
      }

      return;
    }

    const now = Date.now();
    const refreshRest = get().refreshRestingCocks;
    refreshRest();

    set((state) => ({
      cocks: state.cocks.map((cock) => {
        if (cock.id !== id) {
          return cock;
        }

        const needsRestTimestamp =
          updates.lastRestTimestamp === undefined &&
          (updates.energy !== undefined || updates.health !== undefined);

        const mergedUpdates: Partial<Cock> = {
          ...updates,
          ...(needsRestTimestamp ? { lastRestTimestamp: now } : {}),
        };

        return ensureEnergyWithinBounds(
          withFixedStats({
            ...cock,
            ...mergedUpdates,
          })
        );
      }),
    }));
  },

  removeCock: (id) =>
    set((state) => ({
      cocks: state.cocks.filter((cock) => cock.id !== id),
    })),

  addEgg: (egg) => set((state) => ({ eggs: [...state.eggs, egg] })),

  updateEgg: async (id, updates) => {
    if (BACKEND_ENABLED) {
      console.warn('Direct egg updates are managed by the backend');
      return;
    }

    set((state) => ({
      eggs: state.eggs.map((egg) =>
        egg.id === id ? { ...egg, ...updates } : egg
      ),
    }));
  },

  removeEgg: (id) =>
    set((state) => ({
      eggs: state.eggs.filter((egg) => egg.id !== id),
    })),

  startEggIncubation: async (eggId) => {
    if (BACKEND_ENABLED) {
      try {
        await startIncubation(eggId);
        // Only refresh eggs, not everything
        const eggs = await fetchEggs();
        set({ eggs: eggs.map(mapEgg) });
      } catch (error) {
        console.error('Failed to start incubation via backend', error);
        throw error;
      }
      return;
    }

    console.warn('startEggIncubation is noop in offline mode; manage via updateEgg');
  },

  hatchEggAction: async (eggId) => {
    if (BACKEND_ENABLED) {
      try {
        const result = await hatchEgg(eggId);
        // Only refresh eggs and cocks, not everything
        const [eggs, cocks] = await Promise.all([
          fetchEggs(),
          fetchCocks()
        ]);
        const state = get();
        set({ 
          eggs: eggs.map(mapEgg),
          cocks: cocks.map((cock) => mapCock(cock, state.user?.username))
        });
        return result?.cock ? mapCock(result.cock, state.user?.username) : null;
      } catch (error) {
        console.error('Failed to hatch egg via backend', error);
        throw error;
      }
      return null;
    }

    console.warn('hatchEggAction is noop in offline mode; manage via local handlers');
    return null;
  },

  addChicken: (chicken) =>
    set((state) => ({ chickens: [...state.chickens, chicken] })),

  updateChicken: async (id, updates) => {
    if (BACKEND_ENABLED) {
      const payload: { name?: string; description?: string } = {};
      if (typeof updates.name === 'string') {
        payload.name = updates.name;
      }
      if (typeof updates.description === 'string') {
        payload.description = updates.description;
      }

      if (Object.keys(payload).length === 0) {
        console.warn('No chicken fields to update for backend request');
        return;
      }

      try {
        await updateChickenProfileRequest(id, payload);
        // Only refresh chickens, not everything
        const chickens = await fetchChickens();
        set({ chickens: chickens.map(mapChicken) });
      } catch (error) {
        console.error('Failed to update chicken via backend', error);
        throw error;
      }

      return;
    }

    set((state) => ({
      chickens: state.chickens.map((chicken) =>
        chicken.id === id ? { ...chicken, ...updates } : chicken
      ),
    }));
  },

  addItem: (itemId, quantity) =>
    set((state) => ({
      items: {
        ...state.items,
        [itemId]: (state.items[itemId] || 0) + quantity,
      },
    })),

  useItem: async (itemId, cockId) => {
    if (BACKEND_ENABLED) {
      if (!cockId) {
        console.warn('[Store] Cock ID required when using inventory item with backend enabled');
        return false;
      }

      try {
        await useInventoryItem({ itemSlug: itemId, cockId });
        // Only refresh inventory and the specific cock, not everything
        const [inventory, cocks] = await Promise.all([
          fetchInventory(),
          fetchCocks()
        ]);
        const state = get();
        set({ 
          items: mapInventory(inventory),
          cocks: cocks.map((cock) => mapCock(cock, state.user?.username))
        });
        return true;
      } catch (error) {
        console.error('[Store] Failed to use item via backend:', error);
        return false;
      }
    }

    const state = get();
    if (!state.items[itemId] || state.items[itemId] <= 0) {
      return false;
    }
    set((state) => ({
      items: {
        ...state.items,
        [itemId]: state.items[itemId] - 1,
      },
    }));
    return true;
  },

  updateBNBBalance: (amount) => {
    if (BACKEND_ENABLED) {
      console.warn('BNB balance is managed by backend; ignoring manual update');
      return;
    }

    set((state) => ({
      user: state.user
        ? { ...state.user, bnbBalance: state.user.bnbBalance + amount }
        : null,
    }));
  },

  rollRoulette: async (wheelType = 'standard', paymentTxHash?: string) => {
    if (BACKEND_ENABLED) {
      try {
        const spin = await spinWheelRequest({ wheelType, paymentSignature: paymentTxHash });
        
        // If we got a cock or chicken back, add it directly to the store first
        const cockData = (spin as any).cock;
        const chickenData = (spin as any).chicken;
        
        if (cockData) {
          const mappedCock = mapCock(cockData, get().user?.username);
          get().addCock(mappedCock);
          console.log('[Store] Added cock directly from roulette:', mappedCock.id);
        } else if (chickenData) {
          const mappedChicken = mapChicken(chickenData);
          get().addChicken(mappedChicken);
          console.log('[Store] Added chicken directly from roulette:', mappedChicken.id);
        }
        
        // Only refresh essential data after roulette (don't need full refresh)
        setTimeout(async () => {
          try {
            const [newCocks, newInventory] = await Promise.all([
              fetchCocks(),
              fetchInventory(),
            ]);
            set((state) => ({
              cocks: newCocks.map((cock) => mapCock(cock, state.user?.username)),
              items: mapInventory(newInventory),
            }));
          } catch (error) {
            console.error('[Store] Failed to refresh after roulette:', error);
          }
        }, 500);

        const reward = spin.resultReferenceId ?? undefined;

        return {
          success: true,
          reward,
          rewardType: spin.resultType,
          rewardRarity: spin.resultRarity ?? null,
          metadata: spin.metadata, // Include metadata with template info
          cock: cockData, // Full cock data from backend
          chicken: chickenData, // Full chicken data from backend
        };
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : 'Unable to spin the wheel right now.';
        return { success: false, error: message };
      }
    }

    const state = get();
    const cost = 0.1;

    if (!state.user) {
      return Promise.resolve({ success: false, error: 'Connect your wallet to roll a case.' });
    }

    if (state.user.bnbBalance < cost) {
      return Promise.resolve({ success: false, error: 'Insufficient BNB balance.' });
    }

    const isCock = Math.random() < 0.9;

    const rarityWeights: Array<{ rarity: Cock['rarity']; weight: number }> = [
      { rarity: 'common', weight: 45 },
      { rarity: 'uncommon', weight: 30 },
      { rarity: 'rare', weight: 15 },
      { rarity: 'epic', weight: 8 },
      { rarity: 'legendary', weight: 2 },
    ];

    const totalWeight = rarityWeights.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    let selectedRarity: Cock['rarity'] = 'common';

    for (const entry of rarityWeights) {
      if (roll < entry.weight) {
        selectedRarity = entry.rarity;
        break;
      }
      roll -= entry.weight;
    }

    get().updateBNBBalance(-cost);

    if (isCock) {
      const template = getRandomCockByRarity(selectedRarity);
      const cockNumber = get().cocks.length + 1;

      const newCock: Cock = ensureEnergyWithinBounds({
        id: `case-cock-${Date.now()}`,
        templateId: template.templateId,
        name: `CFC Cock #${cockNumber}`,
        description: `CFC Cock #${cockNumber}, fresh meat in the CFC. Untested, unnamed, but ready to spill blood and earn respect. Every cock starts somewhere, this one's ready to peck his way to the top.`,
        image: template.image,
        rarity: selectedRarity,
        stats: { ...FIXED_STATS },
        health: 100,
        energy: calculateMaxEnergy(FIXED_STATS.stamina, selectedRarity),
        wins: 0,
        losses: 0,
        earningsCfc: 0,
        isBreeding: false,
        ownerAddress: state.user.walletAddress,
        ownerUsername: state.user.username,
        lastRestTimestamp: Date.now(),
      });

      get().addCock(newCock);
      return Promise.resolve({ success: true, cock: newCock });
    }

    const chickenTemplate = getRandomChickenByRarity(selectedRarity as any);
    const chickenNumber = get().chickens.length + 1;

    const newChicken: Chicken = {
      id: `case-chicken-${Date.now()}`,
      templateId: chickenTemplate.templateId,
      name: `CFC Chicken #${chickenNumber}`,
      description: '',
      image: chickenTemplate.image,
      rarity: chickenTemplate.rarity,
      isBreeding: false,
    };

    get().addChicken(newChicken);
    return Promise.resolve({ success: true, chicken: newChicken });
  },

  refreshRestingCocks: () => {
    const now = Date.now();
    set((state) => {
      if (!state.cocks.length) {
        return state;
      }

      let changed = false;
      const updatedCocks = state.cocks.map((cock) => {
        const updated = applyRestingRecoveryToCock(cock, now);
        if (updated !== cock) {
          changed = true;
        }
        return updated;
      });

      if (!changed) {
        return state;
      }

      return { cocks: updatedCocks };
    });
  },

  addReferralCode: (code) =>
    set((state) => {
      if (state.referralCodes.some((entry) => entry.code === code.code)) {
        return state;
      }

      const normalized: ReferralCode = {
        ...code,
        totalUses: typeof code.totalUses === 'number' ? code.totalUses : 0,
        referredWallets: Array.isArray(code.referredWallets) ? code.referredWallets : [],
      };

      return {
        referralCodes: [...state.referralCodes, normalized],
      };
    }),

  updateReferralCode: async (code, updates) => {
    if (BACKEND_ENABLED) {
      const payload: { discountPercent?: number; freeWheelSpins?: number; earningsSharePercent?: number } = {};
      if (typeof updates.discountPercent === 'number') {
        payload.discountPercent = updates.discountPercent;
      }
      if (typeof updates.freeWheelSpins === 'number') {
        payload.freeWheelSpins = updates.freeWheelSpins;
      }
      if (typeof updates.earningsSharePercent === 'number') {
        payload.earningsSharePercent = updates.earningsSharePercent;
      }

      if (Object.keys(payload).length === 0) {
        console.warn('No backend-supported referral fields provided for update');
        return;
      }

      try {
        await updateReferralCodeSettings(code, payload);
        // Only refresh referral codes
        const state = get();
        if (state.user?.isAdmin) {
          const adminReferrals = await fetchAdminReferralCodes();
          set({ referralCodes: mapReferralCodes(adminReferrals) });
        } else {
          const referral = await fetchReferrals();
          set({ referralCodes: mapReferralCode(referral) });
        }
      } catch (error) {
        console.error('Failed to update referral code via backend', error);
        throw error;
      }

      return;
    }

    set((state) => ({
      referralCodes: state.referralCodes.map((entry) =>
        entry.code === code ? { ...entry, ...updates } : entry
      ),
    }));
  },

  applyReferralCode: async (rawCode) => {
    const normalizedCode = normalizeReferralCode(rawCode);
    const state = get();

    if (!state.user) {
      return { success: false, error: 'Connect your wallet to apply a referral code.' };
    }

    const walletAddress = state.user.walletAddress;

    if (!normalizedCode) {
      return { success: false, error: 'Enter a referral code to continue.' };
    }

    if (BACKEND_ENABLED) {
      try {
        await applyReferralCodeRequest(normalizedCode);
        // Only refresh user profile (which includes referral info)
        const profile = await fetchProfile();
        if (profile) {
          set({ user: mapUser(profile) });
        }
        return { success: true };
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : 'Unable to apply referral code.';
        return { success: false, error: message };
      }
    }

    if (state.user.referredByCode) {
      return { success: false, error: 'A referral code has already been applied to this account.' };
    }

    const referral = state.referralCodes.find((entry) => entry.code === normalizedCode);
    if (!referral) {
      return { success: false, error: 'Referral code not found. Double-check the code and try again.' };
    }

    if (referral.ownerWallet === walletAddress) {
      return { success: false, error: 'You cannot use your own referral code.' };
    }

    if (referral.referredWallets.includes(walletAddress)) {
      set({
        user: { ...state.user, referredByCode: normalizedCode },
      });
      return { success: true };
    }

    set((storeState) => ({
      user: storeState.user ? { ...storeState.user, referredByCode: normalizedCode } : storeState.user,
      referralCodes: storeState.referralCodes.map((entry) =>
        entry.code === normalizedCode
          ? {
              ...entry,
              totalUses: entry.totalUses + 1,
              referredWallets: Array.from(new Set([...entry.referredWallets, walletAddress])),
            }
          : entry
      ),
    }));

    return { success: true };
  },

  updatePrices: async (payload) => {
    if (!BACKEND_ENABLED) {
      console.warn('Cannot update prices: backend is not enabled');
      return;
    }

    try {
      await updatePricesRequest(payload);
      console.log('Prices updated successfully:', payload);
    } catch (error) {
      console.error('Failed to update prices via backend', error);
      throw error;
    }
  },

  startBreeding: async (cockId, chickenId) => {
    if (BACKEND_ENABLED) {
      try {
        await startBreedingRequest({ cockId, chickenId });
        // Only refresh cocks, chickens, and breeding sessions
        const [cocks, chickens, breedingSessions] = await Promise.all([
          fetchCocks(),
          fetchChickens(),
          listActiveBreedingSessions()
        ]);
        const state = get();
        set({ 
          cocks: cocks.map((cock) => mapCock(cock, state.user?.username)),
          chickens: chickens.map(mapChicken),
          breedingSessions: mapBreedingSessions(breedingSessions)
        });
        return true;
      } catch (error) {
        console.error('Failed to start breeding via backend', error);
        return false;
      }
    }

    const state = get();
    const cock = state.cocks.find((c) => c.id === cockId);
    const chicken = state.chickens.find((c) => c.id === chickenId);
    
    // Check if any breeding is already in progress
    const isAnyBreedingInProgress = state.cocks.some(c => c.isBreeding) || state.chickens.some(c => c.isBreeding);
    
    if (!cock || !chicken || cock.isBreeding || chicken.isBreeding || isAnyBreedingInProgress) {
      return false;
    }

    // Set breeding state for 1 minute (testing - was 24 hours)
    const breedingEndTime = Date.now() + BREEDING_DURATION_MS;
    
    get().updateCock(cockId, {
      isBreeding: true,
      breedingEndTime,
    });

    // Update chicken breeding state
    set((state) => ({
      chickens: state.chickens.map((c) =>
        c.id === chickenId
          ? { ...c, isBreeding: true, breedingEndTime }
          : c
      ),
    }));

    set((state) => ({
      breedingSessions: [
        ...state.breedingSessions,
        {
          id: `offline-breeding-${Date.now()}`,
          userId: state.user?.walletAddress ?? 'offline-user',
          cockId,
          chickenId,
          eggId: undefined,
          status: 'ACTIVE' as const,
          startedAt: Date.now(),
          completesAt: breedingEndTime,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    }));

    return true;
  },

  checkBreedingComplete: async () => {
    if (BACKEND_ENABLED) {
      const state = get();
      const hasDueBreeding = state.breedingSessions.some(
        (session) => session.status === 'ACTIVE' && session.completesAt <= Date.now(),
      );

      if (!hasDueBreeding) {
        return;
      }

      try {
        await processBreedingSessions();
        // Only refresh related data
        const [cocks, chickens, eggs, breedingSessions] = await Promise.all([
          fetchCocks(),
          fetchChickens(),
          fetchEggs(),
          listActiveBreedingSessions()
        ]);
        const currentState = get();
        set({ 
          cocks: cocks.map((cock) => mapCock(cock, currentState.user?.username)),
          chickens: chickens.map(mapChicken),
          eggs: eggs.map(mapEgg),
          breedingSessions: mapBreedingSessions(breedingSessions)
        });
      } catch (error) {
        console.error('Failed to process breeding sessions', error);
      }
      return;
    }

    const state = get();
    const now = Date.now();

    // Check cocks
    state.cocks.forEach((cock) => {
      if (cock.isBreeding && cock.breedingEndTime && now >= cock.breedingEndTime) {
        // Find the chicken that was breeding with this cock
        const chicken = state.chickens.find(
          (c) => c.isBreeding && c.breedingEndTime === cock.breedingEndTime
        );

        if (chicken) {
          // Create a new egg with parent information
          const newEgg: Egg = {
            id: `egg-${Date.now()}`,
            image: '🥚',
            hatchTime: EGG_HATCH_DURATION_MS,
            isIncubating: false,
            parentCockId: cock.id,
            parentChickenId: chicken.id,
            status: 'FRESH',
          };

          get().addEgg(newEgg);

            set((storeState) => ({
              breedingSessions: storeState.breedingSessions.map((session) =>
                session.status === 'ACTIVE' && session.cockId === cock.id
                  ? {
                      ...session,
                      eggId: newEgg.id,
                      status: 'COMPLETED',
                      completedAt: now,
                      updatedAt: now,
                    }
                  : session
              ),
            }));

          // Reset chicken breeding state
          set((state) => ({
            chickens: state.chickens.map((c) =>
              c.id === chicken.id
                ? { ...c, isBreeding: false, breedingEndTime: undefined }
                : c
            ),
          }));
        }

        // Reset cock breeding state
        get().updateCock(cock.id, {
          isBreeding: false,
          breedingEndTime: undefined,
        });
      }
    });

    set((storeState) => ({
      breedingSessions: storeState.breedingSessions.map((session) =>
        session.status === 'ACTIVE' && session.completesAt <= now
          ? {
              ...session,
              status: 'COMPLETED',
              completedAt: now,
              updatedAt: now,
            }
          : session
      ),
    }));
  },

  createFight: async (cockId: string, wager: number, paymentSignature?: string | null, fightId?: string) => {
    if (BACKEND_ENABLED) {
      try {
        const createdFight = await createFightRequest({ 
          cockId, 
          wager, 
          paymentSignature: paymentSignature || undefined,
          fightId,
        });
        // Only refresh fight queue, not everything
        const fights = await fetchFightQueue();
        set({ fightQueue: mapFightQueue(fights) });
        // Return the created fight object with mapped data
        return mapFightQueue([createdFight])[0] || null;
      } catch (error) {
        console.error('Failed to create fight via backend', error);
        return null;
      }
    }

    get().refreshRestingCocks();

    const state = get();
    const cock = state.cocks.find((c) => c.id === cockId);
    
    if (!cock || cock.isBreeding) {
      return false;
    }

    const estimatedRounds = 3; // Best of 3, assume maximum rounds for cost calculation
    const { currentEnergy } = getEnergyStats(cock);
    const fightEnergyCost = calculateEnergyCost(estimatedRounds, cock.stats.stamina);

    if (currentEnergy < fightEnergyCost) {
      return false;
    }

    // Check if user has enough BNB for wager
    if (!state.user || state.user.bnbBalance < wager) {
      return false;
    }

    // Check if cock is already in queue
    const alreadyInQueue = state.fightQueue.some((f) => f.cockId === cockId);
    if (alreadyInQueue) {
      return false;
    }

    // Check if cock is already in an active fight
    const alreadyInActiveFight = state.activeFights.some(
      (f) => (f.cock1Id === cockId || f.cock2Id === cockId) && f.status !== 'finished'
    );
    if (alreadyInActiveFight) {
      return false;
    }

    // Deduct wager from balance
    get().updateBNBBalance(-wager);

    // Add to fight queue
    const newFight: FightQueue = {
      id: `fight-${Date.now()}`,
      cockId,
      wager,
      createdAt: Date.now(),
      ownerAddress: state.user.walletAddress,
      status: 'QUEUED',
      cock: {
        ...cock,
        stats: { ...cock.stats },
      },
    };

    set((state) => ({
      fightQueue: [...state.fightQueue, newFight],
    }));

    return true;
  },

  joinFight: async (fightQueueId: string, cockId: string, paymentSignature?: string) => {
    if (BACKEND_ENABLED) {
      try {
        const updatedFight = await joinFightRequest(fightQueueId, { cockId, paymentSignature });
        // Only refresh fights, not everything
        const [fightQueue, activeFights] = await Promise.all([
          fetchFightQueue(),
          fetchActiveFights()
        ]);
        set({ 
          fightQueue: mapFightQueue(fightQueue),
          activeFights: mapFightHistory(activeFights)
        });
        return updatedFight.id;
      } catch (error) {
        console.error('Failed to join fight via backend', error);
        // Re-throw error to preserve error message for UI
        throw error;
      }
    }

    get().refreshRestingCocks();

    const state = get();
    const fightQueue = state.fightQueue.find((f) => f.id === fightQueueId);
    const challenger = state.cocks.find((c) => c.id === cockId);
    const opponent = state.cocks.find((c) => c.id === fightQueue?.cockId);

    if (!fightQueue || !challenger || !opponent) {
      return null;
    }

    if (fightQueue.ownerAddress === state.user?.walletAddress) {
      return null;
    }

    // Check if cock is available
    if (challenger.isBreeding) {
      return null;
    }

    // Check if challenger is already in queue
    const challengerInQueue = state.fightQueue.some((f) => f.cockId === cockId);
    if (challengerInQueue) {
      return null;
    }

    // Check if challenger is already in an active fight
    const challengerInActiveFight = state.activeFights.some(
      (f) => (f.cock1Id === cockId || f.cock2Id === cockId) && f.status !== 'finished'
    );
    if (challengerInActiveFight) {
      return null;
    }

    const estimatedRounds = 3;
    const { currentEnergy: challengerEnergy } = getEnergyStats(challenger);
    const challengerEnergyCost = calculateEnergyCost(estimatedRounds, challenger.stats.stamina);

    if (challengerEnergy < challengerEnergyCost) {
      return null;
    }

    // Check level restriction (±5 levels for fair fights)
    const challengerLevel = Math.round((challenger.stats.attack + challenger.stats.defence + challenger.stats.stamina + challenger.stats.speed) / 4);
    const opponentLevel = Math.round((opponent.stats.attack + opponent.stats.defence + opponent.stats.stamina + opponent.stats.speed) / 4);
    const levelDifference = Math.abs(challengerLevel - opponentLevel);

    if (levelDifference > 5) {
      return null;
    }

    // Check if user has enough BNB for wager
    if (!state.user || state.user.bnbBalance < fightQueue.wager) {
      return null;
    }

    // Deduct wager from balance
    get().updateBNBBalance(-fightQueue.wager);

    // Remove from queue
    set((state) => ({
      fightQueue: state.fightQueue.filter((f) => f.id !== fightQueueId),
    }));

    // Create active fight in betting phase (3 minutes)
    const now = Date.now();
    const activeFight: ActiveFight = {
      id: `active-${now}`,
      cock1Id: opponent.id,
      cock2Id: challenger.id,
      wager: fightQueue.wager,
      status: 'betting',
      rounds: [],
      currentRound: 0,
      createdAt: now,
      bettingEndTime: now + 3 * 60 * 1000, // 3 minutes
      spectatorBets: [],
      cock1Health: 100,
      cock2Health: 100,
      fightSeed: Math.floor(Math.random() * 1000000),
      fightStartTime: now + 3 * 60 * 1000 + 5000, // Betting ends + 5 second facing
    };

    set((state) => ({
      activeFights: [...state.activeFights, activeFight],
    }));

    return activeFight.id;
  },

  removeFightFromQueue: async (fightQueueId: string) => {
    if (BACKEND_ENABLED) {
      try {
        await cancelFightRequest(fightQueueId);
        // Only refresh fight queue
        const fights = await fetchFightQueue();
        set({ fightQueue: mapFightQueue(fights) });
        
        // ✅ FIX: Refresh claimable CFC after canceling (refund is now available)
        if (typeof (window as any).refreshClaimableCfc === 'function') {
          console.log('[Store] Triggering claimable CFC refresh after fight cancellation');
          (window as any).refreshClaimableCfc();
        }
      } catch (error) {
        console.error('Failed to cancel fight via backend', error);
      }
      return;
    }

    const state = get();
    const fight = state.fightQueue.find((f) => f.id === fightQueueId);
    
    if (!fight) {
      return;
    }

    // Return wager to user
    get().updateBNBBalance(fight.wager);

    // Remove from queue
    set((state) => ({
      fightQueue: state.fightQueue.filter((f) => f.id !== fightQueueId),
    }));
  },

  getFightById: (fightId: string) => {
    const state = get();
    return state.activeFights.find((f) => f.id === fightId);
  },

  placeBet: async (fightId: string, cockId: string, amount: number, paymentSignature?: string) => {
    if (BACKEND_ENABLED) {
      try {
        await placeBetRequest(fightId, { cockId, amount, paymentSignature });
        // Only refresh the specific fight and bets
        const [activeFights, bets] = await Promise.all([
          fetchActiveFights(),
          listBets()
        ]);
        set({ 
          activeFights: mapFightHistory(activeFights),
          spectatorBets: mapSpectatorBets(bets)
        });
        return true;
      } catch (error) {
        console.error('Failed to place bet via backend', error);
        return false;
      }
    }

    const state = get();
    const fight = state.activeFights.find((f) => f.id === fightId);
    
    if (!fight || fight.status !== 'betting') {
      return false;
    }

    // Check if betting time has expired
    if (fight.bettingEndTime && Date.now() >= fight.bettingEndTime) {
      return false;
    }

    // Check if user has enough balance
    if (!state.user || state.user.bnbBalance < amount) {
      return false;
    }

    // Deduct bet amount
    get().updateBNBBalance(-amount);

    // Add bet
    const newBet: SpectatorBet = {
      userId: state.user.walletAddress,
      cockId,
      amount,
      placedAt: Date.now(),
    };

    set((state) => ({
      activeFights: state.activeFights.map((f) =>
        f.id === fightId
          ? { ...f, spectatorBets: [...f.spectatorBets, newBet] }
          : f
      ),
    }));

    return true;
  },      updateFightById: (fightId: string, updates: Partial<ActiveFight>) => {
    set((state) => ({
      activeFights: state.activeFights.map((f) =>
        f.id === fightId ? { ...f, ...updates } : f
      ),
    }));
  },

  loadFightsData: async () => {
    if (!BACKEND_ENABLED) return;
    
    const state = get();
    const now = Date.now();
    const CACHE_DURATION = 2000; // 2 seconds (allow frequent polling for real-time updates)
    
    // Skip if data was fetched very recently (within 2s)
    if (now - state.lastFetchTimestamps.fights < CACHE_DURATION) {
      return;
    }
    
    try {
      const [fights, active, history] = await Promise.all([
        fetchFightQueue(),
        fetchActiveFights(),
        fetchFightHistory(20)
      ]);
      set({
        fightQueue: mapFightQueue(fights),
        activeFights: [...mapFightHistory(active), ...mapFightHistory(history)].sort((a, b) => b.createdAt - a.createdAt),
        lastFetchTimestamps: { ...state.lastFetchTimestamps, fights: now }
      });
    } catch (error) {
      console.error('Failed to load fights data', error);
    }
  },

  loadShopData: async () => {
    if (!BACKEND_ENABLED) return;
    
    const state = get();
    const now = Date.now();
    const CACHE_DURATION = 60000; // 60 seconds (shop data changes less frequently)
    
    // Skip if data was fetched recently (within 60s)
    if (now - state.lastFetchTimestamps.shop < CACHE_DURATION) {
      return;
    }
    
    try {
      const catalog = await listShopCatalog();
      set({ 
        shopCatalog: mapShopCatalog(catalog),
        lastFetchTimestamps: { ...state.lastFetchTimestamps, shop: now }
      });
    } catch (error) {
      console.error('Failed to load shop data', error);
    }
  },

  loadLeaderboardData: async () => {
    if (!BACKEND_ENABLED) return;
    
    const state = get();
    const now = Date.now();
    const CACHE_DURATION = 60000; // 60 seconds (leaderboard updates slowly)
    
    // Skip if data was fetched recently (within 60s)
    if (now - state.lastFetchTimestamps.leaderboard < CACHE_DURATION) {
      return;
    }
    
    try {
      const leaderboard = await fetchLeaderboard();
      set({ 
        leaderboard: mapLeaderboard(leaderboard),
        lastFetchTimestamps: { ...state.lastFetchTimestamps, leaderboard: now }
      });
    } catch (error) {
      console.error('Failed to load leaderboard', error);
    }
  },
    }),
    {
      name: 'game-storage', // name of the item in localStorage
      version: 2,
      migrate: (state: any) => {
        if (!state) {
          return state;
        }

        if (Array.isArray(state.cocks)) {
          const upgradedUser = state.user
            ? (() => {
                const { solBalance, bnbBalance, ...rest } = state.user as Record<string, unknown> & { solBalance?: number; bnbBalance?: number };
                const normalizedBalance =
                  typeof bnbBalance === 'number'
                    ? bnbBalance
                    : typeof solBalance === 'number'
                      ? solBalance
                      : 0;
                return {
                  ...rest,
                  bnbBalance: normalizedBalance,
                } as User;
              })()
            : null;

          return {
            ...state,
            user: upgradedUser,
            cocks: state.cocks.map((cock: Cock) =>
              ensureEnergyWithinBounds({
                ...cock,
                lastRestTimestamp: cock.lastRestTimestamp ?? Date.now(),
              })
            ),
            eggs: Array.isArray(state.eggs)
              ? state.eggs.map((egg: Egg) => ({
                  ...egg,
                  hatchTime: egg.hatchTime && egg.hatchTime > 0 ? Math.max(egg.hatchTime, EGG_HATCH_DURATION_MS) : EGG_HATCH_DURATION_MS,
                  status: egg.status ?? (egg.isIncubating ? 'INCUBATING' : 'FRESH'),
                }))
              : state.eggs,
            referralCodes: Array.isArray(state.referralCodes)
              ? state.referralCodes.map((code: any) => {
                  const referredWallets = Array.isArray(code.referredWallets)
                    ? [...new Set(code.referredWallets.filter((wallet: unknown) => typeof wallet === 'string' && wallet))]
                    : [];
                  const totalUses = typeof code.totalUses === 'number' ? code.totalUses : referredWallets.length;

                  return {
                    code: code.code,
                    ownerWallet: code.ownerWallet ?? '',
                    ownerUsername: code.ownerUsername,
                    discountPercent: typeof code.discountPercent === 'number' ? code.discountPercent : 0,
                    freeWheelSpins: typeof code.freeWheelSpins === 'number' ? code.freeWheelSpins : 0,
                    earningsSharePercent: typeof code.earningsSharePercent === 'number' ? code.earningsSharePercent : 5,
                    totalUses,
                    referredWallets,
                    createdAt: typeof code.createdAt === 'number' ? code.createdAt : Date.now(),
                  };
                })
              : [],
            items: state.items
              ? Object.entries(state.items).reduce((acc: Record<string, number>, [key, value]) => {
                  if (key === 'steroids') {
                    return acc;
                  }
                  acc[key] = typeof value === 'number' ? value : 0;
                  return acc;
                }, {})
              : state.items,
            breedingSessions: Array.isArray(state.breedingSessions) ? state.breedingSessions : [],
            leaderboard: state.leaderboard ?? { mostWins: [], highestEarnings: [] },
          };
        }

        return state;
      },
    }
  )
);