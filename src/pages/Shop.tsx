import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HolographicCard from '../components/ui/HolographicCard';
import { useGameStore, BACKEND_ENABLED } from '../store/gameStore';
import { Cock, Chicken } from '../types';
import { getCockImage } from '../utils/cockImages';
import { getCockHolographicConfig } from '../utils/cockHoloStyles';
import { getRandomCockByRarity } from '../data/cocks';
import { getRandomChickenByRarity } from '../data/chickens';
import { ITEMS } from '../config';
import { useWalletContext } from '../contexts/WalletContext';
import { useWalletBalance } from '../hooks/useWalletBalance';
import { useNativeBalance } from '../hooks/useNativeBalance';
import NetworkMismatchNotice from '../components/NetworkMismatchNotice';

// Map both backend slugs and frontend IDs to images
const ITEM_IMAGE_MAP: Record<string, string> = {
  'capsule': '/assets/Items/Capsule.png',
  'energy-capsule': '/assets/Items/Capsule.png',
  'medkit': '/assets/Items/Medkit.png',
  'med-kit': '/assets/Items/Medkit.png',
};

type RouletteItem = {
  id: string;
  rarity: Cock['rarity'];
  image: string;
  isResult?: boolean;
};

const ROLL_COST = 0.1;
const SPIN_ITEM_WIDTH = 140;
const ITEM_GAP = 16;
const ITEM_FULL_WIDTH = SPIN_ITEM_WIDTH + ITEM_GAP;
const VISIBLE_ITEMS = 5;
const SPIN_LENGTH = 100;
const BASE_RESULT_INDEX = 40;
const ROLL_DURATION_MS = 9000;
const BASE_SPIN_DISTANCE = 28;
const EXTRA_SPIN_VARIATION = 12;
const EASING_POWER = 9.5;

const RARITY_WEIGHTS: Array<{ rarity: Cock['rarity']; weight: number }> = [
  { rarity: 'common', weight: 45 },
  { rarity: 'uncommon', weight: 30 },
  { rarity: 'rare', weight: 15 },
  { rarity: 'epic', weight: 8 },
  { rarity: 'legendary', weight: 2 },
];

const rarityLabels: Record<Cock['rarity'], string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

const rarityAccent: Record<Cock['rarity'], string> = {
  common: 'border-white/15 text-white/70',
  uncommon: 'border-emerald-400/60 text-emerald-300',
  rare: 'border-blue-400/60 text-blue-300',
  epic: 'border-purple-400/60 text-purple-300',
  legendary: 'border-primary/70 text-primary shadow-[0_0_14px_rgba(208,51,51,0.45)]',
};

const rarityGlow: Record<Cock['rarity'], string> = {
  common: 'shadow-[0_0_12px_rgba(255,255,255,0.08)]',
  uncommon: 'shadow-[0_0_18px_rgba(16,185,129,0.35)]',
  rare: 'shadow-[0_0_18px_rgba(59,130,246,0.35)]',
  epic: 'shadow-[0_0_18px_rgba(147,51,234,0.35)]',
  legendary: 'shadow-[0_0_26px_rgba(208,51,51,0.6)]',
};

const pickRandomRarity = (): Cock['rarity'] => {
  const totalWeight = RARITY_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of RARITY_WEIGHTS) {
    if (roll < entry.weight) {
      return entry.rarity;
    }
    roll -= entry.weight;
  }

  return 'common';
};

const buildSpinSequence = (resultRarity: Cock['rarity'], resultImage: string) => {
  const items: RouletteItem[] = [];
  const centerIndex = Math.floor(VISIBLE_ITEMS / 2);
  const randomOffset = Math.floor(Math.random() * 4); // small variation per roll
  const maxResultIndex = SPIN_LENGTH - centerIndex - 2;
  const targetIndex = Math.min(maxResultIndex, Math.max(centerIndex + 1, BASE_RESULT_INDEX + randomOffset));

  for (let i = 0; i < SPIN_LENGTH; i++) {
    const rarity = pickRandomRarity();
    // 90% cock, 10% chicken (but chickens only exist for uncommon/rare/legendary)
    const isCock = Math.random() < 0.9;
    let template;
    
    if (isCock || rarity === 'common' || rarity === 'epic') {
      // Always use cock for common/epic since chickens don't have those rarities
      template = getRandomCockByRarity(rarity);
    } else {
      // Use chicken for uncommon/rare/legendary
      template = getRandomChickenByRarity(rarity as any);
    }
    
    items.push({
      id: `spin-${Date.now()}-${i}-${Math.random().toString(16).slice(2, 6)}`,
      rarity: rarity,
      image: template.image,
    });
  }

  items[targetIndex] = {
    id: `result-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    rarity: resultRarity,
    image: resultImage,
    isResult: true,
  };

  return { items, targetIndex };
};

const buildIdleSequence = () => {
  const items: RouletteItem[] = [];
  for (let i = 0; i < SPIN_LENGTH; i++) {
    const rarity = pickRandomRarity();
    // 90% cock, 10% chicken (but chickens only exist for uncommon/rare/legendary)
    const isCock = Math.random() < 0.9;
    let template;
    
    if (isCock || rarity === 'common' || rarity === 'epic') {
      // Always use cock for common/epic since chickens don't have those rarities
      template = getRandomCockByRarity(rarity);
    } else {
      // Use chicken for uncommon/rare/legendary
      template = getRandomChickenByRarity(rarity as any);
    }
    
    items.push({
      id: `idle-${i}-${Math.random().toString(16).slice(2, 6)}`,
      rarity: rarity,
      image: template.image,
    });
  }
  return items;
};

const formatBnb = (value: number) => Number(value || 0).toFixed(2);
const formatCFC = (value: number) => Number(value || 0).toFixed(0);

const Shop = () => {
  const { t } = useTranslation();
  const { address, provider, isCorrectNetwork } = useWalletContext();
  const user = useGameStore((state) => state.user);
  const rollRoulette = useGameStore((state) => state.rollRoulette);
  const buyShopItem = useGameStore((state) => state.buyShopItem);
  const { balance: cfcBalance } = useWalletBalance(); // $CFC token balance for items
  const { balance: bnbBalance } = useNativeBalance(); // Native BNB for roulette
  const loadShopData = useGameStore((state) => state.loadShopData);
  const shopCatalog = useGameStore((state) => state.shopCatalog);
  const [spinItems, setSpinItems] = useState<RouletteItem[]>(() => buildIdleSequence());
  const [currentOffset, setCurrentOffset] = useState(0);
  const [initialOffset, setInitialOffset] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<Cock | Chicken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorFadingOut, setErrorFadingOut] = useState(false);
  const errorTimeoutRef = useRef<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [showResultModal, setShowResultModal] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [rouletteCost, setRouletteCost] = useState<number>(0.001);
  const [hasFreeSpin, setHasFreeSpin] = useState<boolean>(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  
  // ✅ PERFORMANCE: Add caching to prevent excessive API calls
  const lastPricesFetchRef = useRef<number>(0);
  const PRICES_CACHE_DURATION = 60000; // 60 seconds

  useEffect(() => {
    if (BACKEND_ENABLED) {
      void loadShopData(); // Already has 60s caching
      
      // Fetch roulette cost and user's referral info from backend
      const fetchPrices = async () => {
        // ✅ PERFORMANCE: Skip if fetched recently
        const now = Date.now();
        if (now - lastPricesFetchRef.current < PRICES_CACHE_DURATION) {
          console.log('[Shop] Skipping prices fetch - cached data is fresh');
          return;
        }
        
        try {
          const { getPricesRequest, fetchReferralInfo } = await import('../utils/apiClient');
          const [prices, referralInfo] = await Promise.all([
            getPricesRequest(),
            fetchReferralInfo()
          ]);
          
          lastPricesFetchRef.current = now;
          
          let finalCost = prices.rouletteCost;

          // Apply discount if user has one
          if (referralInfo.discountPercent > 0) {
            finalCost = finalCost * (1 - referralInfo.discountPercent / 100);
          }
          
          setRouletteCost(finalCost);
          setHasFreeSpin(referralInfo.hasFreeSpin);
          setDiscountPercent(referralInfo.discountPercent);
        } catch (error) {
        }
      };
      void fetchPrices();
      
      // Listen for price updates from admin panel
      const handlePriceUpdate = () => {
        // Force refresh by resetting cache timestamp
        lastPricesFetchRef.current = 0;
        void fetchPrices();
        void loadShopData();
      };
      
      window.addEventListener('pricesUpdated', handlePriceUpdate);
      
      return () => {
        window.removeEventListener('pricesUpdated', handlePriceUpdate);
      };
    } else {
      setItemQuantities(ITEMS.reduce((acc, item) => ({ ...acc, [item.id]: 1 }), {}));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!BACKEND_ENABLED) {
      return;
    }

    if (shopCatalog.length > 0) {
      setItemQuantities((prev) => {
        const next: Record<string, number> = {};
        shopCatalog.forEach((item) => {
          next[item.slug] = prev[item.slug] ?? 1;
        });
        return next;
      });
    }
  }, [shopCatalog]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const centerIndex = Math.floor(VISIBLE_ITEMS / 2);

  useLayoutEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setContainerWidth(width);
        
        // Only reset position if not rolling and no result shown
        if (!isRolling && !lastResult) {
          // Center the initial idle sequence
          const centerOffset = width / 2 - SPIN_ITEM_WIDTH / 2;
          const middleItemIndex = Math.floor(SPIN_LENGTH / 2);
          const offset = centerOffset - middleItemIndex * ITEM_FULL_WIDTH;
          setInitialOffset(offset);
          setCurrentOffset(offset);
        }
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [isRolling, lastResult]);

  useEffect(() => {
    // Don't reset the wheel position if we're rolling or have a result
    if (!containerWidth || isRolling || lastResult) return;
    const centerOffset = containerWidth / 2 - SPIN_ITEM_WIDTH / 2;
    setCurrentOffset(centerOffset - centerIndex * ITEM_FULL_WIDTH);
  }, [centerIndex, containerWidth, isRolling, lastResult]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const rarityChances = useMemo(
    () =>
      RARITY_WEIGHTS.map(({ rarity, weight }) => ({
        rarity,
        label: rarityLabels[rarity],
        percent: ((weight / RARITY_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0)) * 100).toFixed(1),
      })),
    []
  );

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (error) {
      setErrorFadingOut(false);
      if (errorTimeoutRef.current !== null) {
        window.clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = window.setTimeout(() => {
        setErrorFadingOut(true);
        setTimeout(() => {
          setError(null);
          setErrorFadingOut(false);
        }, 300); // Wait for fade-out animation to complete
        errorTimeoutRef.current = null;
      }, 5000);
    }
    return () => {
      if (errorTimeoutRef.current !== null) {
        window.clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [error]);

  const handleRoll = async () => {
    if (isRolling) return;

    setError(null);
    setRewardMessage(null);
    setShowResultModal(false);
    setModalClosing(false);
    setLastResult(null);

    try {
      // Check if user has a free spin
      let paymentTxHash: string | undefined;
      
      if (hasFreeSpin) {
        // Free spin - no payment needed!
        setRewardMessage('Using your free spin!');

      } else {
        // Check if user has enough BNB balance for roulette
        const wheelCost = rouletteCost;
        if (bnbBalance < wheelCost) {
          setError(`Insufficient BNB balance. You need ${wheelCost} BNB to spin.`);
          return;
        }

        // Send payment transaction to admin wallet
        if (BACKEND_ENABLED && provider) {
        try {
          const { ADMIN_WALLET_ADDRESS } = await import('../config');
          const { parseEther } = await import('ethers');
          
          if (!ADMIN_WALLET_ADDRESS || ADMIN_WALLET_ADDRESS === 'YOUR_ADMIN_WALLET_ADDRESS') {
            setError('Admin wallet address not configured. Please contact support.');
            return;
          }

          const signer = await provider.getSigner();
          const tx = await signer.sendTransaction({
            to: ADMIN_WALLET_ADDRESS,
            value: parseEther(wheelCost.toString()),
          });

          setError('Processing payment...');
          await tx.wait(); // Wait for transaction confirmation
          paymentTxHash = tx.hash;
          setError(null); // Clear payment message
        } catch (error) {
          console.error('[Shop] Payment transaction failed:', error);
          setError('Payment transaction failed. Please try again.');
          return;
        }
        }
      }

      // Payment confirmed (or free spin), now get the outcome
      setRewardMessage(hasFreeSpin ? 'Getting your free reward!' : 'Getting your reward from the blockchain...');

      const outcome = await rollRoulette('standard', paymentTxHash);

      if (!outcome.success) {
        setError(outcome.error || 'Unable to roll the case right now.');
        return;
      }

      // Use the actual cock/chicken data from backend
      const result = outcome.cock || outcome.chicken;
      
      if (!result) {
        setError('Unable to load reward. Please refresh the page.');
        return;
      }

      if (!result.image) {
        setError('Unable to load reward image. Please refresh the page.');
        return;
      }

      if (!containerWidth) {
        setError('Roulette is still calibrating. Please wait a moment and try again.');
        return;
      }

      // Build the spin sequence and calculate positions BEFORE setting isRolling
      const { items, targetIndex } = buildSpinSequence(result.rarity, result.image);
      const centerOffset = containerWidth / 2 - SPIN_ITEM_WIDTH / 2;
      const targetOffset = centerOffset - targetIndex * ITEM_FULL_WIDTH;
      const desiredDistance = BASE_SPIN_DISTANCE + Math.floor(Math.random() * EXTRA_SPIN_VARIATION);
      const availableForward = Math.max(6, SPIN_LENGTH - 1 - targetIndex);
      const minDistance = Math.min(availableForward, 28);
      const spinDistance = Math.max(minDistance, Math.min(desiredDistance, availableForward));
      const startOffset = targetOffset - ITEM_FULL_WIDTH * spinDistance;

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Set up the spin sequence and position FIRST
      setSpinItems(items);
      setCurrentOffset(startOffset);
      
      // Small delay to ensure DOM updates, then start spinning
      setTimeout(() => {
        setIsRolling(true);
        setRewardMessage('The wheel is spinning... Get ready for the reveal!');
        
        // Start the animation after state is updated
        const duration = ROLL_DURATION_MS;
        let startTime: number | null = null;

        const animate = (time: number) => {
          if (startTime === null) {
            startTime = time;
          }

          const elapsed = time - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, EASING_POWER);
          const offset = startOffset + (targetOffset - startOffset) * eased;

          setCurrentOffset(offset);

          if (progress < 1 && Math.abs(offset - targetOffset) > 1) {
            animationFrameRef.current = requestAnimationFrame(animate);
            return;
          }

          // Animation complete - show final result
          animationFrameRef.current = null;
          setIsRolling(false);
          setCurrentOffset(targetOffset);
          setLastResult(result);
          setShowResultModal(true);
          setModalClosing(false);
        };

        animationFrameRef.current = requestAnimationFrame(animate);
      }, 50);
    } catch (err) {
      console.error('Failed to spin roulette', err);
      setError('Unable to spin the wheel right now.');
      setIsRolling(false);
    }
  };

  const handleCloseModal = () => {
    setModalClosing(true);
    setTimeout(() => {
      setShowResultModal(false);
      setModalClosing(false);
      setLastResult(null);
    }, 220);
  };

  // Use appropriate balance: BNB for roulette, $CFC for items
  const displayCatalog = BACKEND_ENABLED ? shopCatalog : ITEMS;

  const handleIncrement = (itemId: string) => {
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: (prev[itemId] ?? 1) + 1
    }));
  };

  const handleDecrement = (itemId: string) => {
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(1, (prev[itemId] ?? 1) - 1)
    }));
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    const num = parseInt(value) || 1;
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(1, num)
    }));
  };

  const updateBNBBalance = useGameStore((state) => state.updateBNBBalance);

  const handleBuy = async (itemKey: string, price: number, itemName: string) => {
    const quantity = itemQuantities[itemKey] ?? 1;
    if (quantity <= 0) {
      return;
    }

    const totalCost = price * quantity;
    
    if (BACKEND_ENABLED && provider) {
      try {
        const { CFC_TOKEN_MINT, ADMIN_WALLET_ADDRESS } = await import('../config');
        const { Contract, parseUnits } = await import('ethers');
        
        if (!CFC_TOKEN_MINT || CFC_TOKEN_MINT === 'YOUR_CFC_TOKEN_MINT') {
          setError('CFC token not configured');
          return;
        }

        if (!ADMIN_WALLET_ADDRESS || ADMIN_WALLET_ADDRESS === 'YOUR_ADMIN_WALLET_ADDRESS') {
          setError('Admin wallet address not configured');
          return;
        }

        setError('Preparing transaction...');

        // ERC20 ABI for transfer
        const erc20Abi = [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function decimals() view returns (uint8)'
        ];

        const signer = await provider.getSigner();
        const tokenContract = new Contract(CFC_TOKEN_MINT, erc20Abi, signer);

        // Get token decimals
        const decimals = await tokenContract.decimals();

        // Convert amount to token units
        const amountInTokens = parseUnits(totalCost.toString(), decimals);

        setError('Please confirm the transaction in your wallet...');

        // Send transfer transaction
        const tx = await tokenContract.transfer(ADMIN_WALLET_ADDRESS, amountInTokens);

        setError('Transaction sent. Waiting for confirmation...');

        // Wait for confirmation
        await tx.wait();

        setError(null);

        // Call backend with transaction hash
        const success = await buyShopItem(itemKey, quantity, tx.hash);
        
        if (!success) {
          setError('Purchase failed. Please try again.');
          return;
        }

        setRewardMessage(`Purchased ${quantity}× ${itemName}.`);
        return;
      } catch (error: unknown) {
        console.error('Token payment failed:', error);
        const err = error as { code?: string; message?: string };
        if (err.code === 'ACTION_REJECTED') {
          setError('Transaction cancelled');
        } else {
          setError(`Payment failed: ${err.message || 'Unknown error'}`);
        }
        return;
      }
    }
    if (cfcBalance < totalCost) {
      setError(`Insufficient $CFC balance. You need ${formatCFC(totalCost)} $CFC.`);
      return;
    }

    const success = await buyShopItem(itemKey, quantity);
    if (success) {
      updateBNBBalance(-totalCost);
      setError(null);
      setRewardMessage(`Added ${quantity}× ${itemName} to your inventory.`);
    } else {
      setError('Unable to add item to inventory.');
    }
  };

  // Handle network mismatch
  if (address && !isCorrectNetwork) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <NetworkMismatchNotice fullScreen />
      </div>
    );
  }

  // Handle no user/wallet connected
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

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h2 className="text-4xl font-bold text-white">{t('shop.shopTitle')}</h2>
        <p className="mt-2 text-white/60">{t('shop.shopSubtitle1')}</p>
        <p className="text-white/60">{t('shop.shopSubtitle2')}</p>
      </div>

      {/* Roulette Section */}
      <section className="mb-16">
        <div className="rounded border border-white/10 bg-card-dark p-6 shadow-lg shadow-primary/10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-bold text-white">{t('shop.spin2Cock')}</h3>
              <div className="group relative">
                <div className="flex h-6 w-6 cursor-help items-center justify-center rounded-full border border-white/20 bg-white/5 text-xs font-bold text-white/60 transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary">
                  !
                </div>
                <div className="pointer-events-none absolute left-1/2 top-8 z-50 w-80 -translate-x-1/2 rounded border border-white/10 bg-black/95 p-4 opacity-0 shadow-xl transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                  <h4 className="mb-2 text-sm font-bold text-white">{t('shop.howItWorks')}</h4>
                  <ul className="space-y-2 text-xs text-white/70">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">•</span>
                      <span>{t('shop.spinInfo1', { price: formatBnb(rouletteCost) })}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">•</span>
                      <span>{t('shop.spinInfo2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">•</span>
                      <span>{t('shop.spinInfo3')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded border border-white/10 bg-black/40 px-3 py-1 font-semibold text-white/80">
                {t('shop.balance')}: {formatBnb(bnbBalance)} BNB
              </span>
              {hasFreeSpin ? (
                <span className="rounded border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-400 animate-pulse">
                  1 Free Spin Available!
                </span>
              ) : (
                <>
                  <span className="rounded border border-primary/50 bg-primary/10 px-3 py-1 font-semibold text-primary">
                    {t('shop.rollCost')}: {formatBnb(rouletteCost)} BNB
                  </span>
                  {discountPercent > 0 && (
                    <span className="rounded border border-yellow-500/50 bg-yellow-500/10 px-2 py-1 text-xs font-semibold text-yellow-400">
                      {discountPercent}% Discount Applied!
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

            <div ref={containerRef} className="relative mx-auto overflow-hidden rounded border border-white/10 bg-black/60">
              <div
                className="flex py-6"
                style={{
                  transform: `translateX(${isRolling ? currentOffset : initialOffset}px)`,
                  transition: 'none',
                  willChange: 'transform',
                  gap: `${ITEM_GAP}px`,
                }}
              >
                {spinItems.map((item) => {
                  const image = getCockImage(item.image);
                  const holo = getCockHolographicConfig(item.rarity);
                  return (
                    <HolographicCard
                      key={item.id}
                      {...holo}
                      className={`flex h-48 flex-shrink-0 flex-col items-center justify-end overflow-hidden border border-white/5 bg-gradient-to-b from-black/40 to-black/70 px-4 pt-4 pb-4 text-center transition-transform ${rarityGlow[item.rarity]}`}
                      style={{ width: `${SPIN_ITEM_WIDTH}px` }}
                    >
                      <div className="relative mb-3 h-28 w-full overflow-hidden border border-white/10">
                        <img src={image} alt={`${rarityLabels[item.rarity]} cock`} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      </div>
                      <span className={`text-sm font-bold uppercase tracking-wide ${rarityAccent[item.rarity]}`}>
                        {rarityLabels[item.rarity]}
                      </span>
                    </HolographicCard>
                  );
                })}
              </div>

              {/* Pointer */}
              <div className="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 flex-col items-center justify-between">
                <div className="h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-primary"></div>
                <div className="absolute inset-y-0 w-[2px] bg-primary/30"></div>
                <div className="h-0 w-0 border-x-8 border-b-8 border-x-transparent border-b-primary"></div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                {rarityChances.map(({ rarity, label, percent }) => (
                  <span
                    key={rarity}
                    className={`rounded border px-3 py-1 font-semibold ${rarityAccent[rarity]}`}
                  >
                    {label}: {percent}%
                  </span>
                ))}
              </div>

              <button
                onClick={() => void handleRoll()}
                disabled={isRolling}
                className={`flex items-center justify-center gap-2 bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-lg transition-all ${
                  isRolling ? 'cursor-not-allowed opacity-60' : 'hover:shadow-[0_0_20px_rgba(208,51,51,0.6)] hover:brightness-110'
                }`}
              >
                {isRolling ? t('shop.spinning') : t('shop.spinTheWheel')}
              </button>
            </div>

            {isRolling && (
              <div className="mt-6 rounded border border-white/10 bg-black/40 p-4 text-sm text-white/70">
                {t('shop.caseSpinning')}
              </div>
            )}
        </div>
      </section>

      {/* Item Shop */}
      <section className="relative">
        {error && (
          <div className={`absolute -top-14 left-1/2 z-10 w-full max-w-md -translate-x-1/2 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-300 shadow-lg transition-opacity duration-300 ${errorFadingOut ? 'opacity-0' : 'opacity-100'}`}>
            {error}
          </div>
        )}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-white">{t('shop.itemShop')}</h3>
          <span className="rounded border border-white/10 bg-black/40 px-3 py-1 text-sm font-semibold text-white/80">
            Balance: {formatCFC(cfcBalance)} $CFC
          </span>
        </div>
        <div className="mx-auto grid w-full max-w-xl grid-cols-1 gap-x-6 gap-y-10 justify-items-center sm:grid-cols-2">
          {displayCatalog.map((item) => {
            const itemKey = BACKEND_ENABLED ? item.slug : item.id;
            const imageSrc = BACKEND_ENABLED ? ITEM_IMAGE_MAP[item.slug] ?? '/assets/Items/Medkit.png' : item.image;
            const price = item.price;
            const quantity = itemQuantities[itemKey] ?? 1;

            // Get translated name and description
            const itemNameKey = (itemKey === 'capsule' || itemKey === 'energy-capsule') ? 'shop.energyCapsule' : 
                               (itemKey === 'medkit' || itemKey === 'med-kit') ? 'shop.medKit' : 
                               '';
            const itemDescKey = (itemKey === 'capsule' || itemKey === 'energy-capsule') ? 'shop.energyCapsuleDescription' : 
                                (itemKey === 'medkit' || itemKey === 'med-kit') ? 'shop.medKitDescription' : 
                                '';
            const displayName = itemNameKey ? t(itemNameKey) : item.name;
            const displayDesc = itemDescKey ? t(itemDescKey) : item.description;

            return (
              <div key={itemKey} className="flex flex-col items-center gap-3 text-center">
                <div className="h-32 w-32 rounded-lg border border-white/10 bg-black/40 p-2">
                  <img src={imageSrc} alt={displayName} className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-col">
                  <p className="font-bold text-white">{displayName}</p>
                  <p className="text-xs text-white/60">{displayDesc}</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm font-bold text-primary">{formatCFC(price)} $CFC</p>
                  <p className={`text-xs text-white/50 transition-all duration-300 ${quantity > 1 ? 'opacity-100 max-h-4' : 'opacity-0 max-h-0'}`}>
                    {formatCFC(price * quantity)} $CFC {t('shop.total')}
                  </p>
                </div>
                <div className="flex w-full max-w-[140px] items-center justify-center gap-2">
                  <button
                    onClick={() => handleDecrement(itemKey)}
                    className="h-8 w-8 rounded-l-md bg-card-dark text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    -
                  </button>
                  <input
                    className="h-8 w-14 border border-white/10 bg-background-dark text-center text-sm font-bold text-white focus:border-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(itemKey, e.target.value)}
                  />
                  <button
                    onClick={() => handleIncrement(itemKey)}
                    className="h-8 w-8 rounded-r-md bg-card-dark text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => void handleBuy(itemKey, price, item.name)}
                  className="w-full max-w-[140px] rounded bg-primary py-2 text-sm font-bold text-white transition-all hover:shadow-[0_0_15px_rgba(208,51,51,0.5)] hover:brightness-110"
                >
                  {t('shop.buy')}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>

      {showResultModal && lastResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className={`absolute inset-0 bg-black/70 transition-opacity ${modalClosing ? 'opacity-0' : 'opacity-100'}`}
            onClick={handleCloseModal}
          />
          <div
            className={`relative z-10 w-full max-w-xs rounded-lg border border-white/10 bg-black/90 p-6 text-white shadow-[0_24px_60px_rgba(0,0,0,0.55)] transition-all duration-200 ${
              modalClosing ? 'scale-90 opacity-0' : 'modal-pop opacity-100'
            }`}
          >
            <button
              onClick={handleCloseModal}
              className="absolute right-5 top-5 text-white/60 transition-colors hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
            <div className="mb-4 text-center">
              <p className="text-[0.6rem] uppercase tracking-[0.4em] text-white/50">{t('shop.youUnboxed')}</p>
              <h4 className="mt-1 text-xl font-bold text-white">{lastResult.name}</h4>
            </div>

            <div className="mb-4 flex items-center justify-center">
              <span className={`rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] ${rarityAccent[lastResult.rarity]}`}>
                {rarityLabels[lastResult.rarity]}
              </span>
            </div>

            <HolographicCard
              {...getCockHolographicConfig(lastResult.rarity)}
              className={`relative mb-5 aspect-square w-full overflow-hidden border border-white/10 ${rarityGlow[lastResult.rarity]} shadow-inner`}
            >
              <img src={getCockImage(lastResult.image)} alt={`${lastResult.name} portrait`} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
            </HolographicCard>

            {'attack' in lastResult ? (
              <div className="rounded border border-white/10 bg-black/40 p-4 text-center">
                <p className="text-sm text-white/70">{t('shop.readyToFight')}</p>
              </div>
            ) : (
              <div className="rounded border border-white/10 bg-black/40 p-4 text-center">
                <p className="text-sm text-white/70">{t('shop.perfectForBreeding')}</p>
              </div>
            )}

            <button
              onClick={handleCloseModal}
              className="mt-5 w-full rounded border border-primary/50 bg-primary/20 py-2.5 text-xs font-semibold uppercase tracking-[0.35em] text-primary transition-all hover:bg-primary/30"
            >
              {t('shop.claimReward')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Shop;
