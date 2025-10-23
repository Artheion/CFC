import { useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import HolographicCard from '../components/ui/HolographicCard';
import { useGameStore, BACKEND_ENABLED } from '../store/gameStore';
import { ADMIN_WALLET_ADDRESS } from '../config';
import { getCockImage } from '../utils/cockImages';
import { Cock, ReferralCode, ActiveFight } from '../types';
import { getCockHolographicConfig } from '../utils/cockHoloStyles';
import { useWalletContext } from '../contexts/WalletContext';
import NetworkMismatchNotice from '../components/NetworkMismatchNotice';
import { formatBNB, formatCFC } from '../utils/formatNumber';
import { useWalletClient } from 'wagmi';

const Profile = () => {
  const { t } = useTranslation();
  const { address, isCorrectNetwork } = useWalletContext();
  const { data: walletClient } = useWalletClient();
  const { user, cocks: userCocks, activeFights, updateProfileInfo, updateCock, referralCodes, updateReferralCode, updatePrices } = useGameStore();
  const refreshBackendState = useGameStore((state) => state.refreshBackendState);
  const [username, setUsername] = useState(user?.username || '');
  const [allCocksAdmin, setAllCocksAdmin] = useState<any[]>([]);
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [avatarValue, setAvatarValue] = useState(user?.avatarUrl || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'admin'>('profile');
  const [adminTab, setAdminTab] = useState<'cocks' | 'referrals'>('cocks');
  const [cockEdits, setCockEdits] = useState<Record<string, { name: string; description: string; dirty: boolean; saving: boolean }>>({});
  const [referralEdits, setReferralEdits] = useState<Record<string, { discountPercent: string; freeWheelSpins: string; earningsSharePercent: string; dirty: boolean; saving: boolean }>>({});
  const [adminFeedback, setAdminFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [rouletteCost, setRouletteCost] = useState('0.1');
  const [capsulePrice, setCapsulePrice] = useState('1000');
  const [medkitPrice, setMedkitPrice] = useState('1000');
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  
  // ✅ PERFORMANCE: Add caching to prevent excessive API calls
  const lastAdminDataFetchRef = useRef<{ timestamp: number; tab: string }>({ timestamp: 0, tab: '' });
  const lastEarningsFetchRef = useRef<number>(0);
  const ADMIN_DATA_CACHE_DURATION = 60000; // 60 seconds
  const EARNINGS_CACHE_DURATION = 30000; // 30 seconds
  
  const normalizedAdmin = useMemo(() => ADMIN_WALLET_ADDRESS?.toLowerCase(), []);
  const truncatedAddress = useMemo(() => (
    address ? `${address.slice(0, 4)}...${address.slice(-4)}` : null
  ), [address]);

  if (address && !isCorrectNetwork) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <NetworkMismatchNotice fullScreen />
      </div>
    );
  }

  const submitUsernameChange = async () => {
    if (!user) {
      return;
    }
    const trimmed = username.trim();

    if (!trimmed) {
      setAdminFeedback({ type: 'error', message: 'Username cannot be empty.' });
      setUsername(user?.username || '');
      setIsEditingName(false);
      return;
    }

    if (trimmed === user.username) {
      setUsername(trimmed);
      setIsEditingName(false);
      return;
    }

    try {
      await updateProfileInfo({ username: trimmed });
      setUsername(trimmed);
      setAdminFeedback({ type: 'success', message: 'Username updated successfully.' });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Failed to update username.';
      setAdminFeedback({ type: 'error', message });
      setUsername(user.username || trimmed);
    } finally {
      setIsEditingName(false);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setAdminFeedback({ type: 'error', message: 'Please select an image file.' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setAdminFeedback({ type: 'error', message: 'Image size must be less than 5MB.' });
      return;
    }

    setAvatarFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const startAvatarEdit = () => {
    if (!user) {
      return;
    }
    setAvatarValue(user?.avatarUrl || '');
    setAvatarFile(null);
    setAvatarPreview(null);
    setIsEditingAvatar(true);
  };

  const cancelAvatarEdit = () => {
    if (!user) {
      return;
    }
    setAvatarValue(user?.avatarUrl || '');
    setAvatarFile(null);
    setAvatarPreview(null);
    setIsEditingAvatar(false);
  };

  const submitAvatarChange = async () => {
    if (!user) {
      return;
    }

    try {
      if (avatarFile) {
        // Convert file to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(avatarFile);
        });

        const base64String = await base64Promise;
        await updateProfileInfo({ avatarUrl: base64String });
        setAdminFeedback({ type: 'success', message: 'Avatar updated successfully.' });
      } else {
        setAdminFeedback({ type: 'error', message: 'Please select an image file.' });
        return;
      }
      
      setAvatarFile(null);
      setAvatarPreview(null);
      setIsEditingAvatar(false);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Failed to update avatar.';
      setAdminFeedback({ type: 'error', message });
    }
  };

  const removeAvatar = async () => {
    if (!user) {
      return;
    }
    try {
      await updateProfileInfo({ avatarUrl: null });
      setAvatarValue('');
      setIsEditingAvatar(false);
      setAdminFeedback({ type: 'success', message: 'Avatar removed.' });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Failed to update avatar.';
      setAdminFeedback({ type: 'error', message });
    }
  };

  const isAdmin = Boolean(
    address &&
    user &&
    normalizedAdmin &&
    address.toLowerCase() === normalizedAdmin &&
    user.isAdmin
  );

  useEffect(() => {
    if (!isEditingName) {
      setUsername(user?.username || '');
    }
  }, [isEditingName, user?.username]);

  useEffect(() => {
    if (!isEditingAvatar) {
      setAvatarValue(user?.avatarUrl || '');
    }
  }, [isEditingAvatar, user?.avatarUrl]);

  useEffect(() => {
    const cocksToUse = isAdmin && activeTab === 'admin' ? allCocksAdmin : userCocks;
    setCockEdits((prev) => {
      const next: Record<string, { name: string; description: string; dirty: boolean; saving: boolean }> = {};
      cocksToUse.forEach((cock) => {
        const existing = prev[cock.id];
        next[cock.id] = {
          name: existing?.dirty ? existing.name : cock.name,
          description: existing?.dirty ? existing.description : cock.description || '',
          dirty: existing?.dirty ?? false,
          saving: existing?.saving ?? false,
        };
      });
      return next;
    });
  }, [userCocks, allCocksAdmin, isAdmin, activeTab]);

  useEffect(() => {

    setReferralEdits((prev) => {
      const next: Record<string, { discountPercent: string; freeWheelSpins: string; earningsSharePercent: string; dirty: boolean; saving: boolean }> = {};
      referralCodes.forEach((code) => {
        const existing = prev[code.code];
        next[code.code] = {
          discountPercent: existing?.dirty ? existing.discountPercent : code.discountPercent.toString(),
          freeWheelSpins: existing?.dirty ? existing.freeWheelSpins : code.freeWheelSpins.toString(),
          earningsSharePercent: existing?.dirty ? existing.earningsSharePercent : code.earningsSharePercent.toString(),
          dirty: existing?.dirty ?? false,
          saving: existing?.saving ?? false,
        };
      });
      return next;
    });
  }, [referralCodes]);

  useEffect(() => {
    if (!adminFeedback) return;
    const timeout = window.setTimeout(() => setAdminFeedback(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [adminFeedback]);

  useEffect(() => {
    if (isAdmin && activeTab === 'admin') {
      const loadAdminData = async () => {
        // ✅ PERFORMANCE: Skip if fetched recently for this tab
        const now = Date.now();
        if (
          now - lastAdminDataFetchRef.current.timestamp < ADMIN_DATA_CACHE_DURATION &&
          lastAdminDataFetchRef.current.tab === adminTab
        ) {
          console.log('[Profile] Skipping admin data fetch - cached data is fresh');
          return;
        }
        
        setLoadingPrices(true);
        try {
          const { getPricesRequest, fetchAllCocksAdmin } = await import('../utils/apiClient');
          const { mapCock } = await import('../utils/backendMappers');
          
          const [prices, cocksData] = await Promise.all([
            getPricesRequest(),
            fetchAllCocksAdmin()
          ]);
          
          lastAdminDataFetchRef.current.timestamp = now;
          lastAdminDataFetchRef.current.tab = adminTab;
          
          setRouletteCost(prices.rouletteCost.toString());
          setCapsulePrice(prices.capsulePrice.toString());
          setMedkitPrice(prices.medkitPrice.toString());
          
          const mappedCocks = cocksData.map(cock => mapCock(cock, cock.owner?.username));
          setAllCocksAdmin(mappedCocks);
        } catch (error) {
          console.error('[Admin] Failed to load admin data:', error);
          setAdminFeedback({ type: 'error', message: 'Failed to load admin data from server.' });
        } finally {
          setLoadingPrices(false);
        }
      };
      void loadAdminData();
    }
  }, [isAdmin, activeTab, adminTab, ADMIN_DATA_CACHE_DURATION]);

  // Fetch referral earnings - MUST be before early return
  const [referralEarnings, setReferralEarnings] = useState<number>(0);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [lastWithdrawalAt, setLastWithdrawalAt] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  
  // CFC claim state
  const [claimableCfc, setClaimableCfc] = useState<number>(0);
  const [claimableMatchIds, setClaimableMatchIds] = useState<string[]>([]);
  const [isClaimingCfc, setIsClaimingCfc] = useState(false);
  const [cfcClaimError, setCfcClaimError] = useState<string | null>(null);
  const [cfcClaimSuccess, setCfcClaimSuccess] = useState<string | null>(null);
  const lastClaimableFetchRef = useRef<number>(0);
  const CLAIMABLE_CFC_CACHE_DURATION = 15000; // 15 seconds (short because it updates frequently)
  
  useEffect(() => {
    const fetchEarnings = async () => {
      // ✅ PERFORMANCE: Skip if fetched recently
      const now = Date.now();
      if (now - lastEarningsFetchRef.current < EARNINGS_CACHE_DURATION) {
        console.log('[Profile] Skipping earnings fetch - cached data is fresh');
        return;
      }
      
      try {
        const { fetchReferralInfo } = await import('../utils/apiClient');
        const info = await fetchReferralInfo();
        
        lastEarningsFetchRef.current = now;
        
        setReferralEarnings(safeParseAmount(info.ownReferralEarnings ?? info.totalEarnings));
        setTotalEarned(safeParseAmount(info.totalEarnedFromReferrals ?? info.totalEarnings));
        setLastWithdrawalAt(info.lastWithdrawalAt || null);
      } catch (error) {
        console.error('Failed to fetch referral earnings:', error);
      }
    };
    
    if (user && BACKEND_ENABLED) {
      void fetchEarnings();
      // ✅ PERFORMANCE: refreshBackendState already has 30s caching
      void refreshBackendState();
    }
  }, [user, refreshBackendState, EARNINGS_CACHE_DURATION]);

  const handleWithdraw = async () => {
    setWithdrawError(null);
    setWithdrawSuccess(null);

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError('Please enter a valid amount');
      return;
    }

    if (amount < 0.001) {
      setWithdrawError('Minimum withdrawal is 0.001 BNB');
      return;
    }

    if (amount > referralEarnings) {
      setWithdrawError(`Insufficient balance. Available: ${formatBNB(referralEarnings)} BNB`);
      return;
    }

    setIsWithdrawing(true);

    try {
      // Get the access token
      const accessToken = localStorage.getItem('cfc.accessToken');
      
      if (!accessToken) {
        throw new Error('Not authenticated. Please reconnect your wallet.');
      }

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/referrals/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Withdrawal failed');
      }

      setWithdrawSuccess(`Successfully withdrawn ${amount} BNB! TX: ${data.transactionHash.slice(0, 10)}...`);
      setWithdrawAmount('');
      
      // Refresh earnings
      const { fetchReferralInfo } = await import('../utils/apiClient');
      const info = await fetchReferralInfo();
      setReferralEarnings(safeParseAmount(info.ownReferralEarnings ?? info.totalEarnings));
      setTotalEarned(safeParseAmount(info.totalEarnedFromReferrals ?? info.totalEarnings));
      setLastWithdrawalAt(info.lastWithdrawalAt || null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setWithdrawError(errorMessage);
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Fetch claimable CFC amount (includes refunds from cancelled fights)
  const fetchClaimableCfc = useRef(async () => {
    if (!user || !BACKEND_ENABLED) return;
    
    // ✅ PERFORMANCE: Skip if fetched recently
    const now = Date.now();
    if (now - lastClaimableFetchRef.current < CLAIMABLE_CFC_CACHE_DURATION) {
      console.log('[Profile] Skipping claimable CFC fetch - cached data is fresh');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/claimable-cfc`, {
        credentials: 'include', // ✅ SECURITY: Use HttpOnly cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log('[Profile] Not authenticated for claimable CFC');
        }
        return;
      }

      const data = await response.json();
      lastClaimableFetchRef.current = now;
      setClaimableCfc(data.claimableAmount || 0);
      setClaimableMatchIds(data.matchIds || []);
      console.log('[Profile] Claimable CFC updated:', data.claimableAmount);
    } catch (error) {
      console.error('[Profile] Failed to fetch claimable CFC:', error);
    }
  });

  useEffect(() => {
    // Only fetch if user is properly authenticated
    if (user && address) {
      fetchClaimableCfc.current();
    }
  }, [user, address]);
  
  // Export function to allow manual refresh (e.g., after canceling a fight)
  useEffect(() => {
    // Expose refresh function globally for Arena page
    (window as any).refreshClaimableCfc = () => {
      lastClaimableFetchRef.current = 0; // Force refresh
      fetchClaimableCfc.current();
    };
    
    return () => {
      delete (window as any).refreshClaimableCfc;
    };
  }, []);

  // Handle CFC claim (user calls contract directly)
  const handleCfcClaim = async () => {
    setCfcClaimError(null);
    setCfcClaimSuccess(null);

    if (claimableCfc < 100) {
      setCfcClaimError('Minimum claimable amount is 100 $CFC');
      return;
    }

    if (claimableMatchIds.length === 0) {
      setCfcClaimError('No matches to claim from');
      return;
    }

    // Check if wallet is connected
    if (!address) {
      setCfcClaimError('Please connect your wallet first');
      return;
    }

    setIsClaimingCfc(true);

    try {
      // Get escrow contract address and ABI
      const escrowAddress = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS;
      if (!escrowAddress) {
        throw new Error('Escrow contract address not configured');
      }

      // Import ethers
      const { BrowserProvider, Contract } = await import('ethers');

      // Check if wallet is connected via wagmi
      if (!walletClient) {
        throw new Error('Wallet not connected. Please connect your wallet first.');
      }

      // Convert wagmi wallet client to ethers provider (avoids Phantom override)
      // @ts-ignore
      const provider = new BrowserProvider(walletClient);
      const signer = await provider.getSigner();

      // Escrow contract ABI (only claimPayouts function)
      const escrowAbi = [
        'function claimPayouts(bytes32[] calldata matchIds) external'
      ];

      const escrowContract = new Contract(escrowAddress, escrowAbi, signer);

      // Convert UUIDs to bytes32
      const matchBytes32 = claimableMatchIds.map(id => {
        const cleanId = id.replace(/-/g, '');
        return '0x' + cleanId.padEnd(64, '0');
      });

      // Call contract to claim payouts
      const tx = await escrowContract.claimPayouts(matchBytes32);
      
      setCfcClaimSuccess('Transaction submitted! Waiting for confirmation...');
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Notify backend that claim succeeded
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/mark-claimed-cfc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ✅ SECURITY: Use HttpOnly cookies
        body: JSON.stringify({
          matchIds: claimableMatchIds,
          transactionHash: receipt.hash,
        }),
      });

      setCfcClaimSuccess(`Successfully claimed ${claimableCfc.toFixed(2)} $CFC! TX: ${receipt.hash.slice(0, 10)}...`);
      
      // ✅ Refresh claimable CFC after successful claim
      lastClaimableFetchRef.current = 0; // Force refresh
      await fetchClaimableCfc.current();
      
      // Legacy state update (may not be needed after refresh, but kept for safety)
      setClaimableCfc(0);
      setClaimableMatchIds([]);
      
      // Refresh backend state
      await refreshBackendState();
    } catch (error: any) {
      const errorMessage = error?.reason || error?.message || 'Unknown error';
      setCfcClaimError(errorMessage);
    } finally {
      setIsClaimingCfc(false);
    }
  };

  // Calculate cooldown
  const canWithdraw = useMemo(() => {
    if (!lastWithdrawalAt) return true;
    const hoursSinceLastWithdrawal = (Date.now() - new Date(lastWithdrawalAt).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastWithdrawal >= 1;
  }, [lastWithdrawalAt]);

  const cooldownTimeRemaining = useMemo(() => {
    if (!lastWithdrawalAt || canWithdraw) return null;
    const nextWithdrawalTime = new Date(lastWithdrawalAt).getTime() + (60 * 60 * 1000); // +1 hour
    const msRemaining = nextWithdrawalTime - Date.now();
    const minutesRemaining = Math.ceil(msRemaining / (1000 * 60));
    return minutesRemaining;
  }, [lastWithdrawalAt, canWithdraw]);

  const safeParseAmount = (raw: string | number | null | undefined): number => {
    if (raw === null || raw === undefined) {
      return 0;
    }

    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? raw : 0;
    }

    const cleaned = raw.replace(/[,_\s]/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Early return AFTER all hooks
  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <h1 className="mb-4 text-6xl font-bold text-white">{t('hub.title')}</h1>
          <p className="mb-8 text-xl text-white/60">{t('hub.subtitle')}</p>
        </div>
      </div>
    );
  }

  const cocks = isAdmin && activeTab === 'admin' ? allCocksAdmin : userCocks;

  const totalWins = userCocks.reduce((sum, cock) => sum + cock.wins, 0);
  const totalLosses = userCocks.reduce((sum, cock) => sum + cock.losses, 0);
  const totalCFCEarned = userCocks.reduce((sum, cock) => sum + (cock.earningsCfc || 0), 0);

  const referralEntry = referralCodes.find((code) => code.ownerWallet === user.walletAddress);
  const referralCode =
    referralEntry?.code || `CFC-${user.walletAddress.slice(0, 6).toUpperCase()}-${user.walletAddress.slice(-3).toUpperCase()}`;

  const userCockIds = userCocks.map((c) => c.id);
  
  // ✅ FIX: Fetch user-specific fight history instead of relying on activeFights
  const [userFightHistory, setUserFightHistory] = useState<ActiveFight[]>([]);
  const lastHistoryFetchRef = useRef<number>(0);
  const HISTORY_CACHE_DURATION = 30000; // 30 seconds
  
  useEffect(() => {
    const fetchUserHistory = async () => {
      if (!user || !BACKEND_ENABLED) return;
      
      const now = Date.now();
      if (now - lastHistoryFetchRef.current < HISTORY_CACHE_DURATION) {
        return;
      }
      
      try {
        // ✅ Use existing /fights/history endpoint (returns user-specific fights)
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/fights/history?limit=50`, {
          credentials: 'include',
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        const { mapFightHistory } = await import('../utils/backendMappers');
        const mappedHistory = mapFightHistory(data);
        
        lastHistoryFetchRef.current = now;
        setUserFightHistory(mappedHistory);
      } catch (error) {
        console.error('[Profile] Failed to fetch user fight history:', error);
      }
    };
    
    fetchUserHistory();
  }, [user, HISTORY_CACHE_DURATION]);
  
  // Combine activeFights (current) with userFightHistory (past)
  const userFights = useMemo(() => {
    const allFights = [...activeFights, ...userFightHistory];
    const uniqueFights = allFights.filter(
      (fight, index, self) => index === self.findIndex((f) => f.id === fight.id)
    );
    return uniqueFights.filter(
      (fight) => userCockIds.includes(fight.cock1Id) || userCockIds.includes(fight.cock2Id)
    );
  }, [activeFights, userFightHistory, userCockIds]);

  const wagerHistory = userFights
    .filter((fight) => fight.status === 'finished')
    .sort((a, b) => b.createdAt - a.createdAt) // Sort by date, newest first
    .slice(0, 10)
    .map((fight) => {
      const userCock = userCocks.find((c) => c.id === fight.cock1Id || c.id === fight.cock2Id);
      const isWinner = fight.winnerId === userCock?.id;
      const wagerAmount = fight.wager;

      return {
        cockName: userCock?.name || 'Unknown',
        // ✅ FIX: Show net profit/loss (won opponent's wager or lost your wager)
        wager: isWinner ? wagerAmount : -wagerAmount,
        outcome: isWinner ? 'Win' : 'Loss',
        date: fight.createdAt ? new Date(fight.createdAt).toLocaleDateString() : 'Unknown',
      };
    });

  const battleLog = userFights
    .filter((fight) => fight.status === 'finished')
    .sort((a, b) => b.createdAt - a.createdAt) // Sort by date, newest first
    .slice(0, 10)
    .map((fight) => {
      // Use cock data from fight object if available (includes opponent data)
      // Otherwise fall back to userCocks (only has user's own cocks)
      const cock1 = fight.cock1 || userCocks.find((c) => c.id === fight.cock1Id);
      const cock2 = fight.cock2 || userCocks.find((c) => c.id === fight.cock2Id);
      const userCock = userCockIds.includes(fight.cock1Id) ? cock1 : cock2;
      const opponentCock = userCockIds.includes(fight.cock1Id) ? cock2 : cock1;
      const isWinner = fight.winnerId === userCock?.id;

      return {
        userCockName: userCock?.name || 'Unknown',
        userCockRarity: userCock?.rarity || 'common',
        userCockImage: userCock?.image || '',
        opponentName: opponentCock?.name || 'Unknown',
        outcome: isWinner ? 'VICTORY' : 'DEFEAT',
        date: fight.createdAt ? new Date(fight.createdAt).toLocaleDateString() : 'Unknown',
      };
    });

  const getRarityBorder = (rarity: string) => {
    if (rarity === 'legendary') return 'border-rarity-legendary';
    if (rarity === 'epic') return 'border-rarity-epic';
    if (rarity === 'rare') return 'border-rarity-rare';
    if (rarity === 'uncommon') return 'border-rarity-uncommon';
    return 'border-rarity-common';
  };

  const handleCockFieldChange = (cockId: string, field: 'name' | 'description', value: string) => {
    setCockEdits((prev) => {
      const current = prev[cockId] ?? {
        name: '',
        description: '',
        dirty: false,
        saving: false,
      };

      return {
        ...prev,
        [cockId]: {
          ...current,
          [field]: value,
          dirty: true,
        },
      };
    });
  };

  const handleCockReset = (cock: Cock) => {
    setCockEdits((prev) => ({
      ...prev,
      [cock.id]: {
        name: cock.name,
        description: cock.description || '',
        dirty: false,
        saving: false,
      },
    }));
  };

  const handleCockSave = async (cock: Cock) => {
    const edit = cockEdits[cock.id];
    if (!edit) {
      return;
    }

    const trimmedName = edit.name.trim();
    if (!trimmedName) {
      setAdminFeedback({ type: 'error', message: 'Cock name cannot be empty.' });
      return;
    }

    const trimmedDescription = edit.description.trim();

    setCockEdits((prev) => ({
      ...prev,
      [cock.id]: {
        ...prev[cock.id],
        saving: true,
      },
    }));

    try {
      await updateCock(cock.id, { name: trimmedName, description: trimmedDescription });
      setCockEdits((prev) => ({
        ...prev,
        [cock.id]: {
          name: trimmedName,
          description: trimmedDescription,
          dirty: false,
          saving: false,
        },
      }));

      setAdminFeedback({ type: 'success', message: `${trimmedName} updated successfully.` });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Failed to update cock.';
      setCockEdits((prev) => ({
        ...prev,
        [cock.id]: {
          ...prev[cock.id],
          saving: false,
        },
      }));
      setAdminFeedback({ type: 'error', message });
    }
  };

  const handleReferralFieldChange = (
    code: string,
    field: 'discountPercent' | 'freeWheelSpins' | 'earningsSharePercent',
    value: string
  ) => {
    setReferralEdits((prev) => {
      const current = prev[code] ?? {
        discountPercent: '0',
        freeWheelSpins: '0',
        earningsSharePercent: '0',
        dirty: false,
        saving: false,
      };

      return {
        ...prev,
        [code]: {
          ...current,
          [field]: value,
          dirty: true,
        },
      };
    });
  };

  const handleReferralReset = (entry: ReferralCode) => {
    setReferralEdits((prev) => ({
      ...prev,
      [entry.code]: {
        discountPercent: entry.discountPercent.toString(),
        freeWheelSpins: entry.freeWheelSpins.toString(),
        earningsSharePercent: entry.earningsSharePercent.toString(),
        dirty: false,
        saving: false,
      },
    }));
  };

  const handleReferralSave = async (entry: ReferralCode) => {
    const edit = referralEdits[entry.code];
    if (!edit) {
      return;
    }

    const discountValue = Number(edit.discountPercent);
    const freeSpinsValue = Number(edit.freeWheelSpins);
    const earningsValue = Number(edit.earningsSharePercent);

    if (!Number.isFinite(discountValue) || discountValue < 0 || discountValue > 100) {
      setAdminFeedback({ type: 'error', message: `Discount for ${entry.code} must be between 0 and 100%.` });
      return;
    }

    if (!Number.isFinite(freeSpinsValue) || freeSpinsValue < 0) {
      setAdminFeedback({ type: 'error', message: `Free spins for ${entry.code} must be zero or more.` });
      return;
    }

    if (!Number.isFinite(earningsValue) || earningsValue < 0 || earningsValue > 100) {
      setAdminFeedback({ type: 'error', message: `Earnings share for ${entry.code} must be between 0 and 100%.` });
      return;
    }

    const normalizedFreeSpins = Math.floor(freeSpinsValue);
    const normalizedDiscount = Number(discountValue.toFixed(2));
    const normalizedEarnings = Number(earningsValue.toFixed(2));

    setReferralEdits((prev) => ({
      ...prev,
      [entry.code]: {
        ...prev[entry.code],
        saving: true,
      },
    }));

    try {
      await updateReferralCode(entry.code, {
        discountPercent: normalizedDiscount,
        freeWheelSpins: normalizedFreeSpins,
        earningsSharePercent: normalizedEarnings,
      });

      setReferralEdits((prev) => ({
        ...prev,
        [entry.code]: {
          discountPercent: normalizedDiscount.toString(),
          freeWheelSpins: normalizedFreeSpins.toString(),
          earningsSharePercent: normalizedEarnings.toString(),
          dirty: false,
          saving: false,
        },
      }));

      setAdminFeedback({ type: 'success', message: `${entry.code} settings updated.` });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : `Failed to update ${entry.code}.`;
      setReferralEdits((prev) => ({
        ...prev,
        [entry.code]: {
          ...prev[entry.code],
          saving: false,
        },
      }));
      setAdminFeedback({ type: 'error', message });
    }
  };

  const handleUpdatePrices = async () => {
    const rouletteValue = parseFloat(rouletteCost);
    const capsuleValue = parseFloat(capsulePrice);
    const medkitValue = parseFloat(medkitPrice);

    if (isNaN(rouletteValue) || rouletteValue < 0) {
      setAdminFeedback({ type: 'error', message: 'Invalid roulette cost. Must be a positive number.' });
      return;
    }

    if (isNaN(capsuleValue) || capsuleValue < 0) {
      setAdminFeedback({ type: 'error', message: 'Invalid capsule price. Must be a positive number.' });
      return;
    }

    if (isNaN(medkitValue) || medkitValue < 0) {
      setAdminFeedback({ type: 'error', message: 'Invalid medkit price. Must be a positive number.' });
      return;
    }

    setSavingPrices(true);
    try {

      await updatePrices({
        rouletteCost: rouletteValue,
        capsulePrice: capsuleValue,
        medkitPrice: medkitValue,
      });
      

      setAdminFeedback({ 
        type: 'success', 
        message: `Prices updated: Roulette ${rouletteValue} BNB, Capsule ${capsuleValue} $CFC, Medkit ${medkitValue} $CFC` 
      });
      
      // Notify other components that prices were updated
      window.dispatchEvent(new Event('pricesUpdated'));
    } catch (error) {
      console.error('[Admin] Failed to update prices:', error);
      const message = error instanceof Error && error.message ? error.message : 'Failed to update prices.';
      setAdminFeedback({ type: 'error', message });
    } finally {
      setSavingPrices(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {isAdmin && (
        <div className="mb-8 flex items-center justify-center gap-4 bg-card-dark p-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 px-6 py-3 text-sm font-bold transition-all ${
              activeTab === 'profile' ? 'bg-primary text-white shadow-lg' : 'text-white/60 hover:text-white'
            }`}
          >
            👤 My Profile
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 px-6 py-3 text-sm font-bold transition-all ${
              activeTab === 'admin' ? 'bg-primary text-white shadow-lg' : 'text-white/60 hover:text-white'
            }`}
          >
            🔧 Admin Panel
          </button>
        </div>
      )}

      {activeTab === 'profile' ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="col-span-1 lg:col-span-1">
            <div className="bg-card-dark p-6">
              <div className="flex items-center gap-4">
                <div className="relative h-24 w-24 flex-shrink-0">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-primary bg-gradient-to-br from-primary/30 to-primary/10">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={`${user.username ?? 'Player'} avatar`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl">👤</span>
                    )}
                  </div>
                  <button
                    onClick={startAvatarEdit}
                    className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white transition-opacity hover:opacity-90"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {isEditingName ? (
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onBlur={() => void submitUsernameChange()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void submitUsernameChange();
                          }
                        }}
                        className="border-2 border-primary bg-background-dark px-2 py-1 text-2xl font-bold text-white outline-none"
                        autoFocus
                        maxLength={20}
                      />
                    ) : (
                      <>
                        <h2 className="text-2xl font-bold text-white">
                          {username || truncatedAddress}
                        </h2>
                        <button
                          onClick={() => setIsEditingName(true)}
                          className="text-white/60 transition-colors hover:text-white"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>

                </div>
              </div>

              {isEditingAvatar && (
                <div className="mt-6 rounded-lg border border-primary/30 bg-background-dark p-4">
                  <h3 className="mb-3 text-lg font-semibold text-white">{t('profile.editAvatar')}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-2 block text-sm text-white/80">{t('profile.uploadImage')}</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileChange}
                        className="w-full text-sm text-white file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
                      />
                      <p className="mt-1 text-xs text-white/50">{t('profile.imageSizeNote')}</p>
                    </div>
                    {avatarPreview && (
                      <div className="flex items-center justify-center">
                        <div className="h-32 w-32 overflow-hidden rounded-full border-2 border-primary">
                          <img
                            src={avatarPreview}
                            alt="Preview"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => void submitAvatarChange()}
                        disabled={!avatarFile}
                        className="flex-1 rounded bg-primary py-2 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('profile.saveAvatar')}
                      </button>
                      <button
                        onClick={() => void removeAvatar()}
                        className="rounded bg-red-500/20 px-4 py-2 text-sm font-bold text-red-400 transition-all hover:bg-red-500/30"
                      >
                        {t('profile.remove')}
                      </button>
                      <button
                        onClick={cancelAvatarEdit}
                        className="rounded bg-white/10 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-white/20"
                      >
                        {t('profile.cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-white">{totalWins}</p>
                  <p className="text-sm text-white/60">{t('profile.wins')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{totalLosses}</p>
                  <p className="text-sm text-white/60">{t('profile.losses')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{formatCFC(totalCFCEarned)}</p>
                  <p className="text-sm text-white/60">{t('profile.cfcEarned')}</p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white">{t('profile.referralCode')}</h3>
                <div className="mt-2 flex items-center bg-background-dark p-3">
                  <span className="flex-1 font-mono text-white/80">{referralCode}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(referralCode);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="ml-4 flex items-center gap-2 bg-primary/80 px-3 py-1 text-sm font-bold text-white transition-all hover:bg-primary"
                  >
                    <svg className="h-4 w-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span
                      className="transition-all duration-300 ease-in-out"
                      style={{ opacity: 1, transform: isCopied ? 'scale(1.05)' : 'scale(1)' }}
                    >
                      {isCopied ? t('profile.copied') : t('profile.copy')}
                    </span>
                  </button>
                </div>
                
                {/* Referral Earnings & Withdrawal */}
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Total Earned from Referrals:</span>
                    <span className="text-sm font-semibold text-white">{formatBNB(totalEarned)} BNB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Available Balance:</span>
                    <span className="text-lg font-bold text-emerald-400">{formatBNB(referralEarnings)} BNB</span>
                  </div>

                  {/* Withdrawal Form - Always visible */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        max={referralEarnings}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Amount (min 0.001 BNB)"
                        disabled={!canWithdraw || referralEarnings < 0.001}
                        className="flex-1 bg-background-dark border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button
                        onClick={handleWithdraw}
                        disabled={isWithdrawing || !canWithdraw || referralEarnings < 0.001}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed px-4 py-2 text-sm font-bold text-white transition-all"
                      >
                        {isWithdrawing ? 'Processing...' : 'Withdraw'}
                      </button>
                    </div>
                    
                    {!canWithdraw && cooldownTimeRemaining && (
                      <p className="text-xs text-amber-400">
                        ⏳ Cooldown: Please wait {cooldownTimeRemaining} minute{cooldownTimeRemaining !== 1 ? 's' : ''} before next withdrawal
                      </p>
                    )}
                    
                      {canWithdraw && referralEarnings >= 0.001 && (
                      <p className="text-xs text-white/50">Min: 0.001 BNB • Rate limit: 1 withdrawal per hour</p>
                    )}
                    
                      {referralEarnings < 0.001 && (
                      <p className="text-xs text-white/50">Minimum balance of 0.001 BNB required to withdraw</p>
                    )}
                  </div>

                  {withdrawError && (
                    <div className="bg-red-500/10 border border-red-400/60 p-2 text-xs text-red-200">
                      {withdrawError}
                    </div>
                  )}

                  {withdrawSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-400/60 p-2 text-xs text-emerald-200">
                      {withdrawSuccess}
                    </div>
                  )}
                </div>

                {/* CFC Claimable Balance */}
                <div className="mt-6 space-y-3 pt-4 border-t border-white/10">
                  <h4 className="text-sm font-semibold text-white/80">💰 Claimable $CFC from Matches</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Available to Claim:</span>
                    <span className="text-lg font-bold text-primary">{formatCFC(claimableCfc)} $CFC</span>
                  </div>
                  
                  {claimableMatchIds.length > 0 && (
                    <p className="text-xs text-white/50">From {claimableMatchIds.length} completed match{claimableMatchIds.length !== 1 ? 'es' : ''}</p>
                  )}

                  {/* CFC Claim Button */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={handleCfcClaim}
                      disabled={isClaimingCfc || claimableCfc < 100}
                      className="w-full bg-primary hover:bg-primary/90 disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-white transition-all"
                    >
                      {isClaimingCfc ? 'Claiming...' : `Claim ${formatCFC(claimableCfc)} $CFC`}
                    </button>
                    
                    {claimableCfc < 100 && claimableCfc > 0 && (
                      <p className="text-xs text-white/50 text-center">Minimum: 100 $CFC • You have {formatCFC(claimableCfc)} $CFC</p>
                    )}
                    
                    {claimableCfc === 0 && (
                      <p className="text-xs text-white/50 text-center">No CFC available to claim. Win fights to earn more!</p>
                    )}

                    {claimableCfc >= 100 && !isClaimingCfc && (
                      <p className="text-xs text-emerald-400/70 text-center">✓ Ready to claim! Click button to transfer to your wallet</p>
                    )}
                  </div>

                  {cfcClaimError && (
                    <div className="bg-red-500/10 border border-red-400/60 p-2 text-xs text-red-200">
                      ❌ {cfcClaimError}
                    </div>
                  )}

                  {cfcClaimSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-400/60 p-2 text-xs text-emerald-200">
                      ✅ {cfcClaimSuccess}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1 space-y-8 lg:col-span-2">
            <div className="bg-card-dark p-6">
              <h3 className="mb-4 text-xl font-bold text-white">{t('profile.wagerHistory')}</h3>
              {wagerHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-sm text-white/60">
                        <th className="py-2 px-4">{t('profile.cock')}</th>
                        <th className="py-2 px-4">{t('profile.wager')}</th>
                        <th className="py-2 px-4">{t('profile.outcome')}</th>
                        <th className="py-2 px-4">{t('profile.date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wagerHistory.map((wager, index) => (
                        <tr key={index} className="border-b border-white/20">
                          <td className="py-3 px-4 font-semibold">{wager.cockName}</td>
                          <td className={`py-3 px-4 font-bold ${wager.wager > 0 ? 'text-green-400' : 'text-red-500'}`}>
                            {wager.wager > 0 ? '+' : ''}
                            {wager.wager.toFixed(0)} $CFC
                          </td>
                          <td className={`py-3 px-4 ${wager.outcome === 'Win' ? 'text-green-400' : 'text-red-500'}`}>
                            {wager.outcome === 'Win' ? t('profile.win') : t('profile.loss')}
                          </td>
                          <td className="py-3 px-4 text-white/60">{wager.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/30 bg-black/20 p-8 text-center">
                  <span className="text-4xl text-white/30">💰</span>
                  <p className="mt-2 text-sm text-white/60">{t('profile.noWagerHistory')}</p>
                </div>
              )}
            </div>

            <div className="bg-card-dark p-6">
              <h3 className="mb-4 text-xl font-bold text-white">{t('profile.battleLog')}</h3>
              {battleLog.length > 0 ? (
                <div className="space-y-4">
                  {battleLog.map((battle, index) => (
                    <div key={index} className="flex items-center justify-between bg-background-dark p-4">
                      <div className="flex items-center gap-4">
                        <HolographicCard
                          {...getCockHolographicConfig(battle.userCockRarity as Cock['rarity'])}
                          className={`relative h-12 w-12 overflow-hidden border-2 ${getRarityBorder(battle.userCockRarity)}`}
                        >
                          <img
                            src={getCockImage(battle.userCockImage)}
                            alt={`${battle.userCockName} portrait`}
                            className="h-full w-full object-cover"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        </HolographicCard>
                        <div>
                          <p className="font-bold text-white">
                            {battle.userCockName} <span className="text-white/60">{t('profile.vs')}</span> {battle.opponentName}
                          </p>
                          <p className="text-sm text-white/60">{t('profile.arenaBattle')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${battle.outcome === 'VICTORY' ? 'text-green-400' : 'text-red-500'}`}>
                          {battle.outcome === 'VICTORY' ? t('profile.victory') : t('profile.defeat')}
                        </p>
                        <p className="text-sm text-white/60">{battle.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/30 bg-black/20 p-8 text-center">
                  <span className="text-4xl text-white/30">⚔️</span>
                  <p className="mt-2 text-sm text-white/60">{t('profile.noBattles')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-yellow-500/10 border-2 border-yellow-500/30 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold text-yellow-500">Admin Access Granted</p>
                <p className="text-sm text-yellow-500/80">
                  Wallet: {truncatedAddress ?? 'Not connected'}
                </p>
              </div>
            </div>
          </div>

          {adminFeedback && (
            <div
              className={`rounded border px-4 py-2 text-sm font-semibold shadow-lg ${
                adminFeedback.type === 'success'
                  ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                  : 'border-red-400/60 bg-red-500/10 text-red-200'
              }`}
            >
              {adminFeedback.message}
            </div>
          )}

          <div className="flex items-center justify-between border-b border-white/10">
            <div className="flex gap-4">
              {[
                { id: 'cocks', label: 'Cocks', icon: '🐓' },
                { id: 'referrals', label: 'Referral Codes', icon: '🎟️' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAdminTab(tab.id as 'cocks' | 'referrals')}
                  className={`flex items-center gap-2 px-6 py-3 font-bold transition-colors ${
                    adminTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => void refreshBackendState()}
              className="mr-2 rounded border border-white/20 px-3 py-1 text-xs text-white/60 transition-colors hover:border-white/40 hover:text-white"
              title="Refresh data from server"
            >
              🔄 Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section className="space-y-6 bg-card-dark p-6">
              {adminTab === 'cocks' ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-white">Manage Cock Profiles</h2>
                    <span className="text-xs text-white/60">{cocks.length} total</span>
                  </div>
                  {cocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center border border-dashed border-white/20 bg-black/20 p-8 text-center text-sm text-white/60">
                      No cocks found. Hatch or import cocks to manage them here.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cocks.map((cock) => {
                        const edit = cockEdits[cock.id] ?? {
                          name: cock.name,
                          description: cock.description || '',
                          dirty: false,
                          saving: false,
                        };

                        return (
                          <div
                            key={cock.id}
                            className={`rounded border bg-background-dark p-4 transition-colors ${
                              edit.dirty ? 'border-primary/60 shadow-[0_0_20px_rgba(208,51,51,0.25)]' : 'border-white/10'
                            }`}
                          >
                            <div className="flex flex-col gap-4 md:flex-row">
                              <HolographicCard
                                {...getCockHolographicConfig(cock.rarity)}
                                className="relative h-28 w-28 flex-shrink-0 overflow-hidden border-2"
                              >
                                <img
                                  src={getCockImage(cock.image)}
                                  alt={`${cock.name} portrait`}
                                  className="h-full w-full object-cover"
                                />
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                              </HolographicCard>
                              <div className="flex-1 space-y-4">
                                <div>
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">
                                    Display Name
                                  </label>
                                  <input
                                    value={edit.name}
                                    onChange={(e) => handleCockFieldChange(cock.id, 'name', e.target.value)}
                                    className="w-full border border-white/10 bg-background-dark px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                    maxLength={40}
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">
                                    Description
                                  </label>
                                  <textarea
                                    value={edit.description}
                                    onChange={(e) => handleCockFieldChange(cock.id, 'description', e.target.value)}
                                    rows={3}
                                    className="w-full resize-none border border-white/10 bg-background-dark px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                    maxLength={280}
                                  />
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-xs text-white/50">
                                    Owner: {cock.ownerUsername || `${cock.ownerAddress.slice(0, 6)}...${cock.ownerAddress.slice(-4)}`} • Rarity: {cock.rarity.toUpperCase()}
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleCockReset(cock)}
                                      disabled={!edit.dirty || edit.saving}
                                      className="rounded border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Reset
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleCockSave(cock)}
                                      disabled={!edit.dirty || edit.saving}
                                      className="rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {edit.saving ? 'Saving…' : 'Save Changes'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-white">Manage Referral Codes</h2>
                    <span className="text-xs text-white/60">{referralCodes.length} codes</span>
                  </div>
                  {referralCodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center border border-dashed border-white/20 bg-black/20 p-8 text-center text-sm text-white/60">
                      No referral codes available yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {referralCodes.map((entry) => {
                        const edit = referralEdits[entry.code] ?? {
                          discountPercent: entry.discountPercent.toString(),
                          freeWheelSpins: entry.freeWheelSpins.toString(),
                          earningsSharePercent: entry.earningsSharePercent.toString(),
                          dirty: false,
                          saving: false,
                        };

                        return (
                          <div
                            key={entry.code}
                            className={`rounded border bg-background-dark p-4 transition-colors ${
                              edit.dirty ? 'border-primary/60 shadow-[0_0_20px_rgba(208,51,51,0.25)]' : 'border-white/10'
                            }`}
                          >
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-bold text-white">{entry.code}</p>
                                  <p className="text-xs text-white/50">Owner: {entry.ownerUsername || entry.ownerWallet}</p>
                                </div>
                                <p className="text-xs text-white/40">
                                  Joins: {entry.totalUses} • Unique wallets: {entry.referredWallets.length}
                                </p>
                              </div>

                              <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">
                                    Discount %
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={edit.discountPercent}
                                    onChange={(e) => handleReferralFieldChange(entry.code, 'discountPercent', e.target.value)}
                                    className="w-full border border-white/10 bg-background-dark px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">
                                    Free Wheel Spins
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={edit.freeWheelSpins}
                                    onChange={(e) => handleReferralFieldChange(entry.code, 'freeWheelSpins', e.target.value)}
                                    className="w-full border border-white/10 bg-background-dark px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">
                                    Earnings Share %
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={edit.earningsSharePercent}
                                    onChange={(e) =>
                                      handleReferralFieldChange(entry.code, 'earningsSharePercent', e.target.value)
                                    }
                                    className="w-full border border-white/10 bg-background-dark px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                  />
                                </div>
                              </div>

                              {entry.referredWallets.length > 0 && (
                                <div className="rounded border border-white/5 bg-black/20 p-3">
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                                    Recent Referrals
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-xs text-white/60">
                                    {entry.referredWallets
                                      .slice(-5)
                                      .reverse()
                                      .map((wallet) => (
                                        <span
                                          key={wallet}
                                          className="rounded bg-white/5 px-2 py-1 font-mono text-[11px] text-white/70"
                                        >
                                          {wallet.slice(0, 4)}...{wallet.slice(-4)}
                                        </span>
                                      ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleReferralReset(entry)}
                                  disabled={!edit.dirty || edit.saving}
                                  className="rounded border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Reset
                                </button>
                                <button
                                  type="button"
                          onClick={() => void handleReferralSave(entry)}
                                  disabled={!edit.dirty || edit.saving}
                                  className="rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {edit.saving ? 'Saving…' : 'Save Settings'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>

            <aside className="space-y-4 bg-card-dark p-6">
              <h2 className="text-xl font-bold text-white">Admin Controls</h2>

              <div>
                <label className="mb-2 block text-sm text-white/60">Admin Wallet Address</label>
                <div className="border border-white/10 bg-background-dark p-3">
                  <p className="font-mono text-xs text-white break-all">{ADMIN_WALLET_ADDRESS}</p>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/60">Connected Wallet</label>
                <div className="border border-white/10 bg-background-dark p-3">
                  <p className="font-mono text-xs text-white break-all">{address ?? 'Not connected'}</p>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <h3 className="mb-3 text-lg font-bold text-white">Price Settings</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-white/60">Roulette Spin Cost (BNB)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={rouletteCost}
                      onChange={(e) => setRouletteCost(e.target.value)}
                      placeholder="0.1"
                      className="w-full rounded border border-white/10 bg-background-dark px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-white/60">Energy Capsule Price ($CFC)</label>
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={capsulePrice}
                      onChange={(e) => setCapsulePrice(e.target.value)}
                      placeholder="1000"
                      className="w-full rounded border border-white/10 bg-background-dark px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-white/60">Med Kit Price ($CFC)</label>
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={medkitPrice}
                      onChange={(e) => setMedkitPrice(e.target.value)}
                      placeholder="1000"
                      className="w-full rounded border border-white/10 bg-background-dark px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => void handleUpdatePrices()}
                    disabled={savingPrices || loadingPrices}
                    className="w-full rounded bg-primary py-2 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingPrices ? 'Saving...' : loadingPrices ? 'Loading...' : 'Update Prices'}
                  </button>
                </div>
              </div>

              {isEditingAvatar && (
                <div className="mt-4 flex flex-col gap-2">
                  <input
                    type="url"
                    value={avatarValue}
                    onChange={(e) => setAvatarValue(e.target.value)}
                    placeholder="https://example.com/avatar.png"
                    className="w-full rounded border border-primary/30 bg-black/40 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void submitAvatarChange()}
                      className="bg-primary px-3 py-1 text-sm font-semibold text-black transition-all hover:brightness-110"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelAvatarEdit}
                      className="bg-gray-700 px-3 py-1 text-sm font-semibold text-white transition-all hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void removeAvatar()}
                      className="ml-auto border border-red-500/60 px-3 py-1 text-sm font-semibold text-red-300 transition-all hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
