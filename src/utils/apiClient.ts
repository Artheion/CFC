import { BrowserProvider, getAddress } from 'ethers';
import { BNB_CHAIN_CONFIG } from '../config';

interface RequestOptions extends RequestInit {
  authenticated?: boolean;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api';

// ✅ SECURITY: Tokens now stored in HttpOnly cookies (not localStorage!)
// Access token in memory only for display purposes (optional)
let inMemoryAccessToken: string | null = null;

const jsonHeaders = {
  'Content-Type': 'application/json',
};

/**
 * ✅ SECURITY UPGRADE: Silent token refresh using HttpOnly cookies
 * No longer needs refresh token parameter - it's in HttpOnly cookie!
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: jsonHeaders,
      credentials: 'include', // ✅ Send HttpOnly cookies
    });

    if (!response.ok) {
      console.log('[API] Token refresh failed, clearing session');
      inMemoryAccessToken = null;
      return false;
    }

    const data = await response.json();
    
    if (data.authenticated && data.user) {
      console.log('[API] ✅ Token refreshed successfully');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[API] Failed to refresh access token:', error);
    inMemoryAccessToken = null;
    return false;
  }
}

/**
 * ✅ SECURITY UPGRADE: Clear session (logout)
 * Calls backend to revoke refresh token and clear cookies
 */
export async function clearTokens() {
  console.log('[API] Clearing authentication session...');
  inMemoryAccessToken = null;
  
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include', // ✅ Send cookies to be cleared
    });
    console.log('[API] ✅ Session cleared successfully');
  } catch (error) {
    console.error('[API] Failed to clear session:', error);
  }
}

/**
 * ✅ NEW: Check if user has valid authentication session
 * Checks for HttpOnly cookie presence on backend
 */
export async function hasValidAuth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/check`, {
      method: 'GET',
      credentials: 'include', // ✅ Send cookies
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.authenticated === true;
  } catch (error) {
    console.error('[API] Failed to check auth status:', error);
    return false;
  }
}

/**
 * ✅ DEPRECATED: Access token no longer needed in frontend
 * Tokens are in HttpOnly cookies, automatically sent with requests
 */
export function getAccessToken(): string | null {
  console.warn('[API] getAccessToken() is deprecated - tokens are in HttpOnly cookies');
  return inMemoryAccessToken;
}

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authenticated = true, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);

  if (!(rest.body instanceof FormData)) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  // ✅ SECURITY UPGRADE: Send HttpOnly cookies with every request
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    credentials: 'include', // ✅ CRITICAL: Send cookies (access token + refresh token)
  });

  // Handle 401 Unauthorized - try silent token refresh
  if (response.status === 401 && authenticated) {
    console.log('[API] ⚠️ Got 401 Unauthorized, attempting silent token refresh...');
    const refreshed = await refreshAccessToken();
    
    if (refreshed) {
      console.log('[API] ✅ Token refreshed, retrying request to', path);
      // Retry the original request with new tokens (in cookies)
      return request<T>(path, { ...options, authenticated });
    } else {
      console.error('[API] ❌ Token refresh failed, session expired');
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
  createdAt?: string;
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
  winnerCockId?: string | null;
  wager: string;
  status: 'QUEUED' | 'BETTING' | 'FIGHTING' | 'FINISHED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  cock1: BackendCock;
  cock2?: BackendCock | null;
  metadata?: any;
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

// Global authentication state to prevent concurrent auth attempts
let isAuthenticating = false;
let authPromise: Promise<AuthResponse> | null = null;
let lastAuthenticatedAddress: string | null = null;

/**
 * ✅ SECURITY UPGRADE: Authenticate with wallet using HttpOnly cookies
 * Tokens are now stored in secure HttpOnly cookies, not localStorage!
 */
export async function authenticateWithWallet(provider: BrowserProvider, forceReauth: boolean = false): Promise<AuthResponse> {
  if (!provider) {
    throw new Error('Wallet provider not available');
  }

  const signer = await provider.getSigner();
  const currentAddress = getAddress(await signer.getAddress());

  // Check if already authenticated with valid session
  if (!forceReauth && lastAuthenticatedAddress === currentAddress) {
    const hasSession = await hasValidAuth();
    if (hasSession) {
      console.log('[API] ✅ Already authenticated with valid session');
      // Return mock response - actual user data will be loaded separately
      return {
        accessToken: '', // Not needed - in HttpOnly cookie
        refreshToken: '', // Not needed - in HttpOnly cookie
        user: {} as BackendUser,
      };
    }
  }

  // If authenticating for same address, return existing promise
  if (isAuthenticating && authPromise && lastAuthenticatedAddress === currentAddress) {
    console.log('[API] ⏳ Authentication already in progress, reusing promise');
    return authPromise;
  }

  // Start new authentication
  console.log('[API] 🚀 Starting authentication for:', currentAddress);
  isAuthenticating = true;
  lastAuthenticatedAddress = currentAddress;
  
  authPromise = (async () => {
    try {
      // Clear any existing session before new authentication
      await clearTokens();

      const network = await provider.getNetwork();
      const expectedChainId = Number.parseInt(BNB_CHAIN_CONFIG.chainId, 16);

      if (Number(network.chainId) !== expectedChainId) {
        throw new Error('Please switch your wallet to the BNB Chain network before authenticating.');
      }

      const walletAddress = getAddress(await signer.getAddress());
      console.log('[API] 📝 Requesting nonce for:', walletAddress);

      // Get nonce
      const nonceResponse = await request<{ walletAddress: string; message: string }>(
        '/auth/nonce',
        {
          method: 'POST',
          body: JSON.stringify({ walletAddress }),
          authenticated: false,
        },
      );

      console.log('[API] ✍️ Requesting signature from wallet...');
      const signature = await signer.signMessage(nonceResponse.message);

      console.log('[API] 🔐 Signature obtained, logging in...');
      // Login - backend sets HttpOnly cookies automatically
      const loginResponse = await request<{ user: BackendUser; message: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ walletAddress, signature }),
        authenticated: false,
      });

      console.log('[API] ✅ Login successful - tokens stored in secure HttpOnly cookies');
      
      // Return auth response (tokens are in cookies, not response body)
      return {
        accessToken: '', // Not needed
        refreshToken: '', // Not needed
        user: loginResponse.user,
      };
    } catch (error) {
      console.error('[API] ❌ Authentication failed:', error);
      lastAuthenticatedAddress = null; // Allow retry
      throw error;
    } finally {
      // Reset authentication state
      isAuthenticating = false;
      authPromise = null;
    }
  })();

  return authPromise;
}

/**
 * ✅ NEW: Silent token refresh on app load
 * Restores authentication session from HttpOnly cookies
 */
export async function refreshAuthSession(): Promise<{ authenticated: boolean; user?: BackendUser }> {
  try {
    console.log('[API] 🔄 Attempting to restore session from cookies...');
    
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: jsonHeaders,
      credentials: 'include', // ✅ Send HttpOnly cookies
    });

    if (!response.ok) {
      console.log('[API] No valid session found');
      return { authenticated: false };
    }

    const data = await response.json();
    
    if (data.authenticated && data.user) {
      console.log('[API] ✅ Session restored successfully');
      return {
        authenticated: true,
        user: data.user,
      };
    }

    return { authenticated: false };
  } catch (error) {
    console.error('[API] Failed to restore session:', error);
    return { authenticated: false };
  }
}

export function isCurrentlyAuthenticating(): boolean {
  return isAuthenticating;
}

export function clearAuthenticationCache() {
  console.log('[API] Clearing authentication cache');
  lastAuthenticatedAddress = null;
  isAuthenticating = false;
  authPromise = null;
  inMemoryAccessToken = null;
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
    lastWithdrawalAt?: string | null;
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

/**
 * ✅ DEPRECATED: Tokens are now in HttpOnly cookies, not accessible from JavaScript
 * This function is kept for backward compatibility but returns empty values
 */
export function getStoredTokens() {
  console.warn('[API] getStoredTokens() is deprecated - tokens are in HttpOnly cookies');
  return { 
    accessToken: inMemoryAccessToken || '', 
    refreshToken: '' // Not accessible - in HttpOnly cookie
  };
}
