import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import HolographicCard from '../components/ui/HolographicCard';
import { useGameStore, BACKEND_ENABLED } from '../store/gameStore';
import CockStatsModal from '../components/CockStatsModal';
import ChickenCoop from '../3d/ChickenCoop';
import { Cock, Egg } from '../types';
import { getCockImage } from '../utils/cockImages';
import { getCockHolographicConfig } from '../utils/cockHoloStyles';
import { getRandomCockByRarity } from '../data/cocks';
import { calculateMaxEnergy, getEnergyStats } from '../utils/combatSystem';
import { calculateOffspringRarity } from '../utils/breedingSystem';
import { useWalletContext } from '../contexts/WalletContext';
import NetworkMismatchNotice from '../components/NetworkMismatchNotice';
import { formatCFC } from '../utils/formatNumber';

const Hub = () => {
  const { t } = useTranslation();
  const { address, isCorrectNetwork } = useWalletContext();
  const isConnected = Boolean(address);
  const needsNetworkSwitch = Boolean(address && !isCorrectNetwork);
  const {
    cocks: allCocks,
    chickens,
    eggs,
    items,
    user,
    updateEgg,
    addCock,
    removeEgg,
    updateCock,
    useItem,
    startEggIncubation,
    hatchEggAction,
  } = useGameStore();

  const cocks = useMemo(() => {
    if (!user) return [];
    return allCocks.filter(cock => cock.ownerAddress === user.walletAddress);
  }, [allCocks, user]);

  const [selectedCock, setSelectedCock] = useState<Cock | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [draggedEgg, setDraggedEgg] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [hatchedCock, setHatchedCock] = useState<Cock | null>(null);
  const [showHatchModal, setShowHatchModal] = useState(false);
  const [showInventoryInfo, setShowInventoryInfo] = useState(false);
  const [itemFeedback, setItemFeedback] = useState<{ type: 'success' | 'error'; message: string; fading?: boolean } | null>(null);

  // Update timer every second for egg incubator
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check for hatched eggs
  useEffect(() => {
    if (BACKEND_ENABLED) {
      return;
    }

    const incubatingEgg = eggs.find((e) => e.isIncubating);
    if (incubatingEgg && incubatingEgg.incubationStartTime) {
      const endTime = incubatingEgg.incubationStartTime + incubatingEgg.hatchTime;
      if (currentTime >= endTime) {
        void handleHatch(incubatingEgg);
      }
    }
  }, [currentTime, eggs]);

  useEffect(() => {
    if (!itemFeedback) return;
    const timeoutDuration = itemFeedback.type === 'success' ? 3200 : 2600;
    const fadeOutDuration = 500;
    const fadeTimeout = window.setTimeout(() => {
      setItemFeedback(prev => prev ? { ...prev, fading: true } : prev);
    }, timeoutDuration - fadeOutDuration);
    const clearTimeoutId = window.setTimeout(() => setItemFeedback(null), timeoutDuration);
    return () => {
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(clearTimeoutId);
    };
  }, [itemFeedback]);

  const handleHatch = async (egg: Egg) => {
    if (BACKEND_ENABLED) {
      try {
        const result = await hatchEggAction(egg.id);
        if (result) {
          setHatchedCock(result);
          setShowHatchModal(true);
        }
        setItemFeedback({ type: 'success', message: 'Egg hatched! Check your roster.' });
      } catch (error) {
        console.error('Failed to hatch egg', error);
        setItemFeedback({ type: 'error', message: 'Unable to hatch egg. Please try again.' });
      }
      return;
    }

    let rarity: Cock['rarity'];
    
    // Check if egg has parent information (from breeding)
    if (egg.parentCockId && egg.parentChickenId) {
      const parentCock = cocks.find(c => c.id === egg.parentCockId);
      const parentChicken = chickens.find(c => c.id === egg.parentChickenId);
      
      if (parentCock && parentChicken) {
        // Calculate offspring rarity based on parents
        rarity = calculateOffspringRarity(parentCock.rarity, parentChicken.rarity);
        
        // Calculate offspring stats based on parents (chickens don't have stats, use rarity)
      } else {
        // Fallback if parents not found
        rarity = 'common';
      }
    } else {
      // Random hatch for eggs without parents (like starter eggs or shop eggs)
      const rarities: Cock['rarity'][] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      rarity = rarities[Math.floor(Math.random() * rarities.length)];
    }
    
    const template = getRandomCockByRarity(rarity);
    const fixedStats = {
      attack: 40,
      defence: 40,
      stamina: 40,
      speed: 40,
    };

    const maxEnergy = calculateMaxEnergy(fixedStats.stamina, rarity);
    
    // Get current cock count for sequential numbering
    const cockNumber = cocks.length + 1;
    
    const newCock: Cock = {
      id: `cock-${Date.now()}`,
      templateId: template.templateId,
      name: `CFC Cock #${cockNumber}`,
      description: '',
      image: template.image,
      rarity: rarity,
      stats: fixedStats,
      health: 100,
      energy: maxEnergy,
      wins: 0,
      losses: 0,
      earningsCfc: 0,
      ownerAddress: '',
      isBreeding: false,
      lastRestTimestamp: Date.now(),
    };
    
    addCock(newCock);
    removeEgg(egg.id);
    setHatchedCock(newCock);
    setShowHatchModal(true);
  };

  // Item definitions with images
  const itemDefinitions: Record<string, { name: string; image: string }> = {
    'capsule': {
      name: t('shop.energyCapsule'),
      image: '/assets/Items/Capsule.png'
    },
    'energy-capsule': {
      name: t('shop.energyCapsule'),
      image: '/assets/Items/Capsule.png'
    },
    'medkit': {
      name: t('shop.medKit'),
      image: '/assets/Items/Medkit.png'
    },
    'med-kit': {
      name: t('shop.medKit'),
      image: '/assets/Items/Medkit.png'
    },
  };

  // Convert items object to array for display
  const inventory = Object.entries(items)
    .filter(([itemId, count]) => count > 0 && itemDefinitions[itemId])
    .map(([itemId, count]) => ({
      id: itemId,
      name: itemDefinitions[itemId]?.name || itemId,
      image: itemDefinitions[itemId]?.image || '',
      count,
    }));

  // Get incubating and available eggs
  const incubatingEgg = eggs.find((egg) => egg.isIncubating);
  const readyEggs = eggs.filter((egg) => !egg.isIncubating && egg.status === 'READY_TO_HATCH');
  const availableEggs = eggs.filter((egg) => !egg.isIncubating && egg.status === 'FRESH');
  
  // Calculate remaining time for incubating egg
  const formatTime = (milliseconds: number) => {
    if (milliseconds <= 0) return '00:00:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const getRemainingTime = () => {
    if (!incubatingEgg) return 0;
    const targetTime = incubatingEgg.readyAt
      ? incubatingEgg.readyAt
      : incubatingEgg.incubationStartTime
        ? incubatingEgg.incubationStartTime + incubatingEgg.hatchTime
        : null;
    if (!targetTime) return 0;
    return Math.max(0, targetTime - currentTime);
  };

  // Drag and drop handlers
  const handleItemDragStart = (itemId: string) => {
    setDraggedItem(itemId);
  };

  const handleItemDragEnd = () => {
    setDraggedItem(null);
  };

  const handleEggDragStart = (eggId: string) => {
    setDraggedEgg(eggId);
  };

  const handleEggDragEnd = () => {
    setDraggedEgg(null);
  };

  const handleIncubatorDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedEgg || incubatingEgg) {
      return;
    }

    if (BACKEND_ENABLED) {
      try {
        await startEggIncubation(draggedEgg);
        setItemFeedback({ type: 'success', message: 'Egg incubation started!' });
      } catch (error) {
        console.error('Failed to start incubation', error);
        setItemFeedback({ type: 'error', message: 'Unable to start incubation. Please try again.' });
      } finally {
        setDraggedEgg(null);
      }
      return;
    }

    const egg = eggs.find((entry) => entry.id === draggedEgg);
    const hatchDuration = egg?.hatchTime && egg.hatchTime > 0 ? Math.max(egg.hatchTime, 48 * 60 * 60 * 1000) : 48 * 60 * 60 * 1000;
    const startedAt = Date.now();
    void updateEgg(draggedEgg, {
      isIncubating: true,
      incubationStartTime: startedAt,
      hatchTime: hatchDuration,
      status: 'INCUBATING',
      readyAt: startedAt + hatchDuration,
    });
    setDraggedEgg(null);
  };

  const handleIncubatorDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const applyItemToCock = async (targetCock: Cock) => {
    if (!draggedItem) return;
    const itemId = draggedItem;



    // Handle both 'medkit' and 'med-kit' slugs
    if (itemId === 'medkit' || itemId === 'med-kit') {

      
      if (targetCock.health >= 100) {

        setItemFeedback({ type: 'error', message: `${targetCock.name} already has full health.` });
        setDraggedItem(null);
        return;
      }
      
      if (targetCock.health >= 50) {

        setItemFeedback({ type: 'error', message: `${targetCock.name}'s health must be below 50 to use Med Kit.` });
        setDraggedItem(null);
        return;
      }


      const success = await useItem(itemId, targetCock.id);
      
      if (!success) {
        setItemFeedback({ type: 'error', message: 'Failed to use Med Kit.' });
        setDraggedItem(null);
        return;
      }

      if (!BACKEND_ENABLED) {
        const healAmount = 50;
        const newHealth = Math.min(100, targetCock.health + healAmount);
        updateCock(targetCock.id, { health: parseFloat(newHealth.toFixed(2)) });
      }


      setItemFeedback({ type: 'success', message: `${targetCock.name} recovered 50 health!` });
      setDraggedItem(null);
      return;
    }

    // Handle both 'capsule' and 'energy-capsule' slugs
    if (itemId === 'capsule' || itemId === 'energy-capsule') {
      const { maxEnergy } = getEnergyStats(targetCock);
      const energyThreshold = Math.floor(maxEnergy * 0.75);

      
      if (targetCock.energy >= maxEnergy) {

        setItemFeedback({ type: 'error', message: `${targetCock.name} already has full energy.` });
        setDraggedItem(null);
        return;
      }
      
      if (targetCock.energy >= energyThreshold) {

        setItemFeedback({ type: 'error', message: `${targetCock.name}'s energy must be below ${energyThreshold} to use Energy Capsule.` });
        setDraggedItem(null);
        return;
      }


      const success = await useItem(itemId, targetCock.id);
      
      if (!success) {
        setItemFeedback({ type: 'error', message: 'Failed to use Energy Capsule.' });
        setDraggedItem(null);
        return;
      }

      if (!BACKEND_ENABLED) {
        const energyGain = Math.floor(maxEnergy * 0.25);
        const newEnergy = Math.min(maxEnergy, targetCock.energy + energyGain);
        updateCock(targetCock.id, { energy: parseFloat(newEnergy.toFixed(2)) });
      }


      setItemFeedback({ type: 'success', message: `${targetCock.name} gained 25% energy!` });
      setDraggedItem(null);
      return;
    }

    // Unknown item
    setItemFeedback({ type: 'error', message: `Unknown item: ${itemId}` });
    setDraggedItem(null);
  };

  const handleCockDragOver = (e: React.DragEvent) => {
    if (draggedItem) {
      e.preventDefault();
    }
  };

  const handleCockDrop = (e: React.DragEvent, targetCock: Cock) => {
    if (!draggedItem) return;
    e.preventDefault();
    void applyItemToCock(targetCock);
  };

  // Calculate stats from actual cocks data
  const totalWins = cocks.reduce((sum, cock) => sum + cock.wins, 0);
  const totalLosses = cocks.reduce((sum, cock) => sum + cock.losses, 0);
  const totalFights = totalWins + totalLosses;
  const winRatio = totalFights > 0 ? ((totalWins / totalFights) * 100).toFixed(1) : '0.0';
  // Calculate total CFC earned by user from all their cocks
  const totalCFCEarned = cocks.reduce((sum, cock) => sum + (cock.earningsCfc || 0), 0);
  
  // Find user's highest ranking cock from leaderboard
  const { leaderboard } = useGameStore();
  const getUserHighestRank = () => {
    if (!user || !leaderboard) return 'N/A';
    
    // Check Most Wins leaderboard
    const userCockIds = cocks.map(c => c.id);
    const userCocksInLeaderboard = leaderboard.mostWins.filter(
      entry => userCockIds.includes(entry.cock.id)
    );
    
    if (userCocksInLeaderboard.length === 0) return 'N/A';
    
    // Find the highest ranked cock (lowest index)
    const highestRankIndex = leaderboard.mostWins.findIndex(
      entry => userCockIds.includes(entry.cock.id)
    );
    
    return highestRankIndex >= 0 ? `#${highestRankIndex + 1}` : 'N/A';
  };
  
  const highestCockRank = getUserHighestRank();

  // Calculate total BNB earned (based on wins - 0.1 BNB per win as example)

  if (needsNetworkSwitch) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <NetworkMismatchNotice fullScreen />
      </div>
    );
  }

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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 overflow-hidden">
      <div className="grid grid-cols-12 gap-8 h-[calc(100vh-8rem)]">
        {itemFeedback && (
          <div
            className={`fixed left-1/2 top-24 z-50 -translate-x-1/2 border px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition-opacity duration-400 ${
              itemFeedback.type === 'success'
                ? 'border-emerald-400/50 bg-card-dark text-emerald-200'
                : 'border-red-500/70 bg-card-dark text-red-200'
            } ${itemFeedback.fading ? 'opacity-0' : 'opacity-100'}`}
          >
            {itemFeedback.message}
          </div>
        )}
        {/* Left Column - Inventory */}
        <div className="col-span-2">
          <div className="sticky top-24 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-white">{t('hub.myItems')}</h3>
              <button
                type="button"
                className="group relative flex h-5 w-5 items-center justify-center rounded-full border border-white/30 text-[10px] font-bold text-white/60 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                onMouseEnter={() => setShowInventoryInfo(true)}
                onMouseLeave={() => setShowInventoryInfo(false)}
                onFocus={() => setShowInventoryInfo(true)}
                onBlur={() => setShowInventoryInfo(false)}
              >
                !
                {showInventoryInfo && (
                  <div className="absolute left-1/2 top-7 z-40 w-60 -translate-x-1/2 rounded-lg border border-white/20 bg-background-dark px-3 py-2 text-left text-xs text-white shadow-xl">
                    {t('hub.inventoryInfoText')}
                  </div>
                )}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleItemDragStart(item.id)}
                  onDragEnd={handleItemDragEnd}
                  className={`group relative cursor-grab overflow-hidden rounded border border-white/10 bg-black/40 transition-colors active:cursor-grabbing ${draggedItem === item.id ? 'border-primary/60 bg-primary/10' : ''}`}
                >
                  <div className="aspect-square w-full p-1">
                    <img src={item.image} alt={item.name} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                  </div>
                  <div className="absolute bottom-0.5 right-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
                    x{item.count}
                  </div>
                </div>
              ))}
              {readyEggs.map((egg) => (
                <button
                  key={egg.id}
                  type="button"
                  onClick={() => void handleHatch(egg)}
                  className="group relative flex aspect-square items-center justify-center overflow-hidden rounded border border-emerald-400/60 bg-emerald-500/10 text-3xl text-emerald-200 transition-colors hover:bg-emerald-500/20"
                >
                  🥚
                  <span className="absolute bottom-1 left-1 right-1 rounded bg-emerald-600/80 px-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
                    {t('hub.readyToHatch')}
                  </span>
                </button>
              ))}
              {availableEggs.map((egg) => (
                <div
                  key={egg.id}
                  draggable
                  onDragStart={() => handleEggDragStart(egg.id)}
                  onDragEnd={handleEggDragEnd}
                  className="group relative cursor-grab overflow-hidden rounded border border-white/10 bg-gradient-to-br from-primary/20 to-primary/10 active:cursor-grabbing"
                >
                  <div className="aspect-square w-full p-0.5">
                    <img src="/assets/Items/Egg.png" alt="Egg" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-110" loading="lazy" />
                  </div>
                </div>
              ))}
              {[...Array(Math.max(0, 9 - inventory.length - availableEggs.length - readyEggs.length))].map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square border-2 border-dashed border-white/20 bg-white/5"></div>
              ))}
            </div>
            
            {/* Egg Incubator */}
            <div className="mt-4 bg-card-dark p-4">
              <h3 className="mb-3 text-lg font-bold text-white">{t('hub.eggIncubator')}</h3>
              <div className="space-y-3">
                <div
                  onDrop={handleIncubatorDrop}
                  onDragOver={handleIncubatorDragOver}
                  className={`flex flex-col items-center gap-2 p-3 text-center transition-colors ${
                    !incubatingEgg && draggedEgg
                      ? 'border-2 border-primary bg-primary/10'
                      : 'border-2 border-transparent'
                  }`}
                >
                  {incubatingEgg ? (
                    <>
                      <div className="group relative h-16 w-16 flex-shrink-0 overflow-hidden rounded border border-white/10 bg-gradient-to-br from-primary/30 to-primary/20 p-1">
                        <img src="/assets/Items/Egg.png" alt="Incubating Egg" className="h-full w-full object-contain" loading="lazy" />
                      </div>
                      <p className="text-xl font-bold text-primary">{formatTime(getRemainingTime())}</p>
                    </>
                  ) : (
                    <>
                      <div className="flex h-16 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-white/20 bg-white/5 p-3 transition-colors hover:border-primary/50 hover:bg-primary/10">
                        <span className="text-4xl">🥚</span>
                      </div>
                      <p className="text-xl font-bold text-white/40">00:00:00</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column - Stats and 3D Preview */}
        <div className="col-span-8 flex flex-col items-center gap-4">
          <div className="text-center">
            <h3 className="mb-2 text-2xl font-bold text-white">Your Cocks' Stats</h3>
            <div className="grid grid-cols-4 gap-8 text-center">
              <div>
                <p className="text-sm text-white/60">{t('profile.totalCocks')}</p>
                <p className="text-2xl font-bold text-white">{cocks.length}</p>
              </div>
              <div>
                <p className="text-sm text-white/60">{t('profile.winRate')}</p>
                <p className="text-2xl font-bold text-primary">{winRatio}%</p>
              </div>
              <div>
                <p className="text-sm text-white/60">$CFC Earned</p>
                <p className="text-2xl font-bold text-white">{formatCFC(totalCFCEarned)}</p>
              </div>
              <div>
                <p className="text-sm text-white/60">{t('leaderboard.rank')}</p>
                <p className="text-2xl font-bold text-white">{highestCockRank}</p>
              </div>
            </div>
          </div>
          <div className="w-full max-w-2xl border border-white/10 bg-black shadow-lg shadow-primary/20 overflow-hidden">
            <ChickenCoop cocks={cocks} />
          </div>
        </div>

        {/* Right Column - Your Cocks */}
        <div className="col-span-2">
          <div className="sticky top-24 space-y-4">
            <h2 className="text-2xl font-bold text-white">{t('hub.myCocks')}</h2>
            <div className="max-h-[calc(100vh-12rem)] space-y-4 overflow-y-auto scrollbar-hide">
              {cocks.map((cock) => {
                const rarityColor = cock.rarity === 'legendary' ? 'border-rarity-legendary' : 
                                    cock.rarity === 'epic' ? 'border-rarity-epic' : 
                                    cock.rarity === 'rare' ? 'border-rarity-rare' :
                                    cock.rarity === 'uncommon' ? 'border-rarity-uncommon' :
                                    'border-rarity-common';
                
                const cockImage = getCockImage(cock.image);
                const cardClasses = draggedItem
                  ? 'flex cursor-pointer items-center gap-4 rounded border border-primary/60 bg-primary/10 p-3 transition-colors'
                  : 'flex cursor-pointer items-center gap-4 rounded border border-transparent bg-white/5 p-3 transition-colors hover:bg-white/10';
                
                return (
                  <div
                    key={cock.id}
                    className={cardClasses}
                    onDragOver={handleCockDragOver}
                    onDrop={(e) => handleCockDrop(e, cock)}
                    onClick={() => {
                      if (draggedItem) return;
                      setSelectedCock(cock);
                    }}
                  >
                    <HolographicCard
                      {...getCockHolographicConfig(cock.rarity)}
                      className={`relative h-16 w-16 flex-shrink-0 overflow-hidden border-2 ${rarityColor}`}
                    >
                      <img
                        src={cockImage}
                        alt={`${cock.name} portrait`}
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    </HolographicCard>
                    <div>
                      <p className="font-bold text-white">{cock.name}</p>
                      <p className="text-sm text-white/60">{cock.wins}/{cock.losses}</p>
                    </div>
                  </div>
                );
              })}
              {[...Array(Math.max(0, 2 - (cocks.length - 6)))].map((_, i) => (
                <div
                  key={`empty-cock-${i}`}
                  className="flex h-24 cursor-pointer items-center justify-center border-2 border-dashed border-white/20 bg-white/5 transition-colors hover:border-white/40 hover:bg-white/10"
                >
                  <span className="text-sm text-white/60">{t('hub.emptySlot')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedCock && (
        <CockStatsModal
          cock={selectedCock}
          onClose={() => setSelectedCock(null)}
          allowEdit={true}
        />
      )}

      {/* Hatch Modal */}
      {showHatchModal && hatchedCock && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn"
          onClick={() => {
            setShowHatchModal(false);
            setHatchedCock(null);
          }}
        >
          <div 
            className="relative w-full max-w-md border border-white/10 bg-card-dark shadow-2xl animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="absolute right-4 top-4 z-10 text-white/60 transition-colors hover:text-white" 
              onClick={() => {
                setShowHatchModal(false);
                setHatchedCock(null);
              }}
            >
              <span className="text-3xl">×</span>
            </button>

            <div className="p-8 text-center">
              {/* Title */}
              <div className="mb-6">
                <h1 className="text-4xl font-bold text-white">{t('hub.hatchSuccess')}</h1>
              </div>

              {/* Cock Image */}
              <div className="mb-6 flex justify-center">
                <HolographicCard
                  {...getCockHolographicConfig(hatchedCock.rarity)}
                  className={`relative h-64 w-64 overflow-hidden border-4 ${
                    hatchedCock.rarity === 'legendary' ? 'border-rarity-legendary' :
                    hatchedCock.rarity === 'epic' ? 'border-rarity-epic' :
                    hatchedCock.rarity === 'rare' ? 'border-rarity-rare' :
                    hatchedCock.rarity === 'uncommon' ? 'border-rarity-uncommon' :
                    'border-rarity-common'
                  }`}
                >
                  <img
                    src={getCockImage(hatchedCock.image)}
                    alt={hatchedCock.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                </HolographicCard>
              </div>

              {/* Name and Rarity */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">{hatchedCock.name}</h2>
                <div className="inline-block">
                  <span className={`text-sm font-semibold uppercase tracking-wider px-3 py-1 rounded-full border ${
                    hatchedCock.rarity === 'legendary' ? 'text-rarity-legendary border-rarity-legendary/50 bg-rarity-legendary/10' :
                    hatchedCock.rarity === 'epic' ? 'text-rarity-epic border-rarity-epic/50 bg-rarity-epic/10' :
                    hatchedCock.rarity === 'rare' ? 'text-rarity-rare border-rarity-rare/50 bg-rarity-rare/10' :
                    hatchedCock.rarity === 'uncommon' ? 'text-rarity-uncommon border-rarity-uncommon/50 bg-rarity-uncommon/10' :
                    'text-rarity-common border-rarity-common/50 bg-rarity-common/10'
                  }`}>
                    {hatchedCock.rarity}
                  </span>
                </div>
              </div>

              {/* Continue Button */}
              <button
                onClick={() => {
                  setShowHatchModal(false);
                  setHatchedCock(null);
                }}
                className="w-full bg-primary py-3 font-bold uppercase tracking-wider text-white transition-all hover:brightness-110"
              >
                {t('common.gotIt')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hub;
