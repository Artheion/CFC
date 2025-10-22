import { BrowserProvider, getAddress } from 'ethers';
import { BNB_CHAIN_CONFIG } from '../config';

interface RequestOptions extends RequestInit {
  authenticated?: boolean;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api';
const ACCESS_TOKEN_KEY = 'cfc.accessToken';
const REFRESH_TOKEN_KEY = 'cfc.refreshToken';

let accessToken: string | null = localStorage.getItem(ACCESS_TOKEN_KEY);
let refreshToken: string | null = localStorage.getItem(REFRESH_TOKEN_KEY);

const jsonHeaders = {
  'Content-Type': 'application/json',
};

async function refreshAccessToken(): Promise<void> {
  if (!refreshToken) {
    throw new Error('Missing refresh token');
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh access token');
  }

  const data = await response.json();
  setTokens(data.accessToken, data.refreshToken ?? refreshToken);
}

function setTokens(nextAccessToken: string | null, nextRefreshToken: string | null) {
  accessToken = nextAccessToken;
  refreshToken = nextRefreshToken;

  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function clearTokens() {
  setTokens(null, null);
}

export function hasValidAuth(): boolean {
  // Reload from storage in case it was set in another tab/component
  reloadTokensFromStorage();
  return Boolean(accessToken);
}

export function getAccessToken(): string | null {
  reloadTokensFromStorage();
  return accessToken;
}

function reloadTokensFromStorage() {
  const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  
  if (storedAccessToken && storedAccessToken !== accessToken) {
    console.log('[API] Reloading access token from localStorage');
    accessToken = storedAccessToken;
  }
  
  if (storedRefreshToken && storedRefreshToken !== refreshToken) {
    console.log('[API] Reloading refresh token from localStorage');
    refreshToken = storedRefreshToken;
  }
}

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authenticated = true, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);

  if (!(rest.body instanceof FormData)) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  // Ensure tokens are synced from localStorage before authenticated requests
  if (authenticated && !accessToken) {
    console.log('[API] No token in memory, reloading from localStorage...');
    reloadTokensFromStorage();
  }

  if (authenticated && accessToken) {
    const authHeader = `Bearer ${accessToken}`;
    finalHeaders.set('Authorization', authHeader);
    console.log(`[API] ✓ Request to ${path}`);
    console.log(`[API] Token (first 30 chars): ${accessToken.substring(0, 30)}...`);
    console.log(`[API] Authorization header set: Bearer ${accessToken.substring(0, 30)}...`);
  } else if (authenticated && !accessToken) {
    console.error(`[API] ❌ CRITICAL: No access token available for authenticated request to ${path}`);
    console.error('[API] localStorage has token:', !!localStorage.getItem(ACCESS_TOKEN_KEY));
    console.error('[API] memory has token:', !!accessToken);
    throw new Error('No authentication token available');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  if (response.status === 401 && authenticated && refreshToken) {
    console.log('[API] ⚠️ Got 401 Unauthorized, attempting token refresh...');
    try {
      await refreshAccessToken();
      console.log('[API] ✓ Token refresh successful, retrying request to', path);
      return request<T>(path, { ...options, authenticated });
    } catch (error) {
      console.error('[API] ❌ Token refresh failed, clearing tokens', error);
      clearTokens();
      // Don't throw - let the caller handle the auth failure
      throw new Error('Authentication session expired. Please reconnect your wallet.');
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => undefined);

  if (!response.ok) {
    const cause = (payload as { message?: string })?.message ?? 'Request failed';
    throw new Error(cause);
  }

  return payload as T;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: BackendUser;
}

export interface BackendUser {
  id: string;
  walletAddress: string;
  username?: string | null;
  avatarUrl?: string | null;
  bnbBalance: string | number;
  isAdmin: boolean;
  hasCompletedOnboarding: boolean;
  referredByCode?: string | null;
}

export interface BackendCock {
  id: string;
  templateId: string;
  ownerId: string;
  name: string;
  description?: string | null;
  image: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  attack: number;
  defence: number;
  stamina: number;
  speed: number;
  health: number;
  energy: number;
  maxEnergy: number;
  wins: number;
  losses: number;
  earningsCfc: string;
  isBreeding: boolean;
  breedingEndTime?: string | null;
  lastRecoveryAt?: string | null;
  healthUpdatedAt?: string | null;
  energyUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: {
    walletAddress: string;
    username?: string | null;
  } | null;
}

export interface BackendChicken {
  id: string;
  templateId: string;
  ownerId: string;
  name: string;
  description?: string | null;
  image: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  isBreeding: boolean;
  breedingEndTime?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackendEgg {
  id: string;
  ownerId: string;
  image: string;
  hatchTimeMs: number;
  isIncubating: boolean;
  incubationStart?: string | null;
  readyAt?: string | null;
  status: 'FRESH' | 'INCUBATING' | 'READY_TO_HATCH' | 'HATCHED';
  parentCockId?: string | null;
  parentChickenId?: string | null;
  hatchedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackendBreedingSession {
  id: string;
  userId: string;
  cockId: string;
  chickenId: string;
  eggId?: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  completesAt: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackendInventoryItem {
  id: string;
  itemCatalogId: string;
  quantity: number;
  itemCatalog: {
    slug: string;
    name: string;
    description: string;
    type: 'MEDKIT' | 'CAPSULE' | 'CUSTOM';
    priceBnb: string;
  };
}

export interface BackendReferralCode {
  code: string;
  ownerWallet: string;
  ownerUsername?: string | null;
  discountPercent: number;
  freeWheelSpins: number;
  earningsSharePercent: number;
  totalUses: number;
  totalEarnedBnb: string;
  joins?: Array<{
    joinedWallet: string;
    joinedAt: string;
    joinedUsername?: string | null;
  }>;
}

export interface BackendLeaderboardEntry {
  cock: BackendCock;
  ownerWallet: string;
  ownerUsername?: string | null;
  wins: number;
  losses: number;
  earningsBnb: string;
  winRate: number;
}

export interface BackendLeaderboardResponse {
  mostWins: BackendLeaderboardEntry[];
  highestEarnings: BackendLeaderboardEntry[];
}

export interface BackendFight {
  id: string;
  cock1Id: string;
  cock2Id?: string | null;
  wager: string;
  status: 'QUEUED' | 'BETTING' | 'FIGHTING' | 'FINISHED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  cock1: BackendCock;
  cock2?: BackendCock | null;
  rounds?: Array<{
    roundNo: number;
    winnerCock?: string | null;
    cock1Health: number;
    cock2Health: number;
  }>;
  spectatorBets?: BackendSpectatorBet[];
}

export interface BackendSpectatorBet {
  id: string;
  fightId: string;
  userId: string;
  cockId: string;
  amount: string;
  status: 'PENDING' | 'WON' | 'LOST';
  placedAt: string;
  payoutAmount?: string | null;
  fight?: BackendFight;
  user?: {
    walletAddress: string;
    username?: string | null;
  } | null;
}

export interface BackendCatalogItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: 'MEDKIT' | 'CAPSULE' | 'CUSTOM';
  priceBnb: string;
  priceCfc: string;
  maxPerUser?: number | null;
}

export interface BackendWheelSpin {
  id: string;
  userId: string;
  resultType: string;
  resultReferenceId?: string | null;
  resultRarity?: string | null;
  costBnb: string;
  referralPaid: string;
  signature?: string | null;
  metadata?: unknown;
  createdAt: string;
}

export async function authenticateWithWallet(provider: BrowserProvider): Promise<AuthResponse> {
  if (!provider) {
    throw new Error('Wallet provider not available');
  }

  // Clear any existing tokens before new authentication
  // This prevents stale tokens from interfering with reconnection
  console.log('[API] Clearing existing tokens before authentication');
  clearTokens();

  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  const expectedChainId = Number.parseInt(BNB_CHAIN_CONFIG.chainId, 16);

  if (Number(network.chainId) !== expectedChainId) {
    throw new Error('Please switch your wallet to the BNB Chain network before authenticating.');
  }

  const walletAddress = getAddress(await signer.getAddress());
  console.log('[API] Requesting nonce for wallet:', walletAddress);
  
  const nonceResponse = await request<{ walletAddress: string; message: string }>(
    '/auth/nonce',
    {
      method: 'POST',
      body: JSON.stringify({ walletAddress }),
      authenticated: false,
    },
  );

  console.log('[API] Signing message...');
  const signature = await signer.signMessage(nonceResponse.message);

  console.log('[API] Logging in with signature...');
  const authResponse = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, signature }),
    authenticated: false,
  });

  console.log('[API] ✅ Authentication successful!');
  console.log('[API] Access token:', authResponse.accessToken ? authResponse.accessToken.substring(0, 30) + '...' : 'MISSING');
  console.log('[API] Refresh token:', authResponse.refreshToken ? 'Present' : 'MISSING');
  
  setTokens(authResponse.accessToken, authResponse.refreshToken);
  
  console.log('[API] Tokens stored. Verifying localStorage...');
  console.log('[API] localStorage accessToken:', localStorage.getItem(ACCESS_TOKEN_KEY) ? 'Saved ✓' : 'NOT SAVED ✗');
  console.log('[API] localStorage refreshToken:', localStorage.getItem(REFRESH_TOKEN_KEY) ? 'Saved ✓' : 'NOT SAVED ✗');

  return authResponse;
}

export async function fetchProfile() {
  return request<BackendUser>('/users/me');
}

export async function fetchReferralInfo() {
  return request<{
    hasReferralCode: boolean;
    referralCode?: string;
    discountPercent: number;
    hasFreeSpin: boolean;
    totalEarnings: string;
    ownReferralCode?: string;
    ownReferralEarnings: string;
    totalEarnedFromReferrals?: string;
  }>('/users/referral-info');
}

export async function updateProfile(payload: { username?: string; avatarUrl?: string | null; hasCompletedOnboarding?: boolean }) {
  return request<BackendUser>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updateCockProfileRequest(cockId: string, payload: { name?: string; description?: string }) {
  return request<BackendCock>(`/cocks/${cockId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function triggerCockRecoveryRequest(cockId: string) {
  return request<BackendCock>(`/cocks/${cockId}/rest`, {
    method: 'POST',
  });
}

export async function fetchCocks() {
  return request<BackendCock[]>('/cocks');
}

export async function fetchAllCocksAdmin() {
  return request<BackendCock[]>('/admin/cocks');
}

export async function fetchChickens() {
  return request<BackendChicken[]>('/chickens');
}

export async function updateChickenProfileRequest(chickenId: string, payload: { name?: string; description?: string }) {
  return request<BackendChicken>(`/chickens/${chickenId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function fetchEggs() {
  return request<BackendEgg[]>('/eggs');
}

export async function startIncubation(eggId: string) {
  return request<BackendEgg>(`/eggs/${eggId}/incubate`, { method: 'POST' });
}

export async function hatchEgg(eggId: string) {
  return request<{ egg: BackendEgg; cock: BackendCock }>(`/eggs/${eggId}/hatch`, { method: 'POST' });
}

export async function fetchInventory() {
  return request<BackendInventoryItem[]>('/inventory');
}

export async function useInventoryItem(payload: { itemSlug: string; cockId: string }) {
  return request<{ cock: BackendCock; remainingQuantity: number }>(`/inventory/use`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchReferrals() {
  return request<BackendReferralCode | null>('/referrals/me');
}

export async function fetchAdminReferralCodes() {
  return request<BackendReferralCode[]>('/admin/referrals');
}

export async function applyReferralCodeRequest(code: string) {
  return request(`/referrals/apply`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function updateReferralCodeSettings(
  code: string,
  payload: { discountPercent?: number; freeWheelSpins?: number; earningsSharePercent?: number },
) {
  return request<BackendReferralCode>(`/referrals/${code}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updatePricesRequest(payload: { rouletteCost?: number; capsulePrice?: number; medkitPrice?: number }) {
  return request(`/admin/prices`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getPricesRequest() {
  return request<{ rouletteCost: number; capsulePrice: number; medkitPrice: number }>(`/shop/prices`, { authenticated: false });
}

export async function fetchLeaderboard() {
  return request<BackendLeaderboardResponse>('/cocks/leaderboard');
}

export async function fetchFightQueue() {
  return request<BackendFight[]>(`/fights/queue`);
}

export async function fetchActiveFights() {
  return request<BackendFight[]>(`/fights/active`);
}

export async function fetchFightHistory(limit = 20) {
  return request<BackendFight[]>(`/fights/history?limit=${limit}`);
}

export async function fetchFightDetails(fightId: string) {
  return request<BackendFight>(`/fights/${fightId}`);
}

export async function createFightRequest(payload: { cockId: string; wager: number; paymentSignature?: string; fightId?: string }) {
  return request<BackendFight>(`/fights`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function joinFightRequest(fightId: string, payload: { cockId: string; paymentSignature?: string }) {
  return request<BackendFight>(`/fights/${fightId}/join`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function cancelFightRequest(fightId: string) {
  return request<BackendFight>(`/fights/${fightId}/cancel`, {
    method: 'PATCH',
  });
}

export async function listBets() {
  return request<BackendSpectatorBet[]>(`/bets`);
}

export async function placeBetRequest(fightId: string, payload: { cockId: string; amount: number; paymentSignature?: string }) {
  return request<BackendSpectatorBet>(`/bets/${fightId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listShopCatalog() {
  return request<BackendCatalogItem[]>(`/shop/catalog`, { authenticated: false });
}

export async function buyItemRequest(payload: { itemSlug: string; quantity: number; paymentSignature?: string }) {
  return request<BackendInventoryItem>(`/shop/items/buy`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function spinWheelRequest(payload: { wheelType: string; paymentSignature?: string }) {
  return request<BackendWheelSpin>(`/shop/roulette/spin`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function startBreedingRequest(payload: { cockId: string; chickenId: string }) {
  return request<BackendBreedingSession>(`/breeding/start`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function processBreedingSessions() {
  return request<{ processed: number; eggsCreated: Array<{ id: string }> }>(`/breeding/process`, {
    method: 'POST',
  });
}

export async function listActiveBreedingSessions() {
  return request<BackendBreedingSession[]>(`/breeding/active`);
}

export function getStoredTokens() {
  return { accessToken, refreshToken };
}

export type {
  BackendCock,
  BackendChicken,
  BackendEgg,
  BackendInventoryItem,
  BackendReferralCode,
  BackendFight,
  BackendSpectatorBet,
  BackendCatalogItem,
  BackendWheelSpin,
  BackendLeaderboardEntry,
  BackendLeaderboardResponse,
};
