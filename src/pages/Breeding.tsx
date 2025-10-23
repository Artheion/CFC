import { useState, useEffect, useRef, useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import HolographicCard from '../components/ui/HolographicCard';
import { useGameStore } from '../store/gameStore';
import { Cock, Chicken, BreedingSession } from '../types';
import { getCockImage } from '../utils/cockImages';
import { getCockHolographicConfig } from '../utils/cockHoloStyles';
import { useWalletContext } from '../contexts/WalletContext';
import NetworkMismatchNotice from '../components/NetworkMismatchNotice';

type DragState = {
  pointerId: number | null;
  isActive: boolean;
  startX: number;
  scrollLeft: number;
  hasMoved: boolean;
  initialTarget: EventTarget | null;
};

const useDragScroll = (enabled: boolean) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState>({
    pointerId: null,
    isActive: false,
    startX: 0,
    scrollLeft: 0,
    hasMoved: false,
    initialTarget: null,
  });
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      isActive: true,
      startX: event.clientX,
      scrollLeft: container.scrollLeft,
      hasMoved: false,
      initialTarget: event.target as EventTarget,
    };
    setIsDragging(false);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!enabled || !state.isActive) return;
    const container = containerRef.current;
    if (!container) return;
    const deltaX = event.clientX - state.startX;

    if (!state.hasMoved && Math.abs(deltaX) > 3) {
      state.hasMoved = true;
      setIsDragging(true);
      try {
        container.setPointerCapture(state.pointerId!);
      } catch (error) {
        console.warn('Pointer capture failed:', error);
      }
    }

    if (state.hasMoved) {
      event.preventDefault();
      container.scrollLeft = state.scrollLeft - deltaX;
    }
  };

  const finishDrag = (event?: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state.isActive) return;
    const container = containerRef.current;
    const pointerId = state.pointerId;
    if (container && typeof pointerId === 'number' && state.hasMoved) {
      try {
        container.releasePointerCapture(pointerId);
      } catch (error) {
        console.warn('Pointer release failed:', error);
      }
    }
    dragStateRef.current = {
      pointerId: null,
      isActive: false,
      startX: 0,
      scrollLeft: 0,
      hasMoved: false,
      initialTarget: null,
    };
    setIsDragging(false);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const { hasMoved, initialTarget } = dragStateRef.current;
    finishDrag(event);
    if (!hasMoved && initialTarget instanceof HTMLElement) {
      initialTarget.click();
    }
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    finishDrag(event);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    finishDrag(event);
  };

  return {
    containerRef,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handlePointerCancel,
  };
};

const Breeding = () => {
  const { t } = useTranslation();
  const {
    cocks: allCocks,
    chickens,
    breedingSessions,
    user,
    startBreeding,
    checkBreedingComplete,
    updateCock,
    updateChicken,
  } = useGameStore();
  const { address, isCorrectNetwork } = useWalletContext();

  const cocks = useMemo(() => {
    if (!user) return [];
    return allCocks.filter(cock => cock.ownerAddress === user.walletAddress);
  }, [allCocks, user]);

  const [selectedCock, setSelectedCock] = useState<Cock | null>(null);
  const [selectedChicken, setSelectedChicken] = useState<Chicken | null>(null);
  const [, setTick] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  if (address && !isCorrectNetwork) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <NetworkMismatchNotice fullScreen />
      </div>
    );
  }

  // Fix: Reset any stuck breeding states on mount - only for truly broken states
  useEffect(() => {
    if (cocks.length === 0 && chickens.length === 0) return; // Wait for data to load
    
    const now = Date.now();
    const maxBreedingTime = 48 * 60 * 60 * 1000; // 48 hours max
    
    cocks.forEach(cock => {
      // Only reset if no endTime OR endTime is unreasonably far in future
      // Don't reset completed breeding (endTime in past) - let checkBreedingComplete handle that
      if (cock.isBreeding && (!cock.breedingEndTime || 
                              cock.breedingEndTime > now + maxBreedingTime)) {

        updateCock(cock.id, { isBreeding: false, breedingEndTime: undefined });
      }
    });
    chickens.forEach(chicken => {
      // Only reset if no endTime OR endTime is unreasonably far in future
      // Don't reset completed breeding (endTime in past) - let checkBreedingComplete handle that
      if (chicken.isBreeding && (!chicken.breedingEndTime || 
                                 chicken.breedingEndTime > now + maxBreedingTime)) {

        updateChicken(chicken.id, { isBreeding: false, breedingEndTime: undefined });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cocks.length, chickens.length]); // Only run when counts change, not on every state update

  // Check for completed breeding every second and force re-render for timer
  useEffect(() => {
    const interval = setInterval(() => {
      void checkBreedingComplete();
      setTick(t => t + 1); // Force re-render to update timer display
    }, 1000);

    return () => clearInterval(interval);
  }, [checkBreedingComplete]);

  // On mount, check if any cock/chicken is currently breeding and auto-select them
  useEffect(() => {
    if (!selectedCock && !selectedChicken) {
      const breedingCock = cocks.find(c => c.isBreeding);
      const breedingChicken = chickens.find(c => c.isBreeding);
      
      if (breedingCock) {
        setSelectedCock(breedingCock);
      }
      if (breedingChicken) {
        setSelectedChicken(breedingChicken);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cocks, chickens]); // Run when cocks/chickens load

  // Update selected cock/chicken if they change in the store
  useEffect(() => {
    if (selectedCock) {
      const updatedCock = cocks.find(c => c.id === selectedCock.id);
      if (updatedCock) {
        setSelectedCock(updatedCock);
      }
    }
    if (selectedChicken) {
      const updatedChicken = chickens.find(c => c.id === selectedChicken.id);
      if (updatedChicken) {
        setSelectedChicken(updatedChicken);
      }
    }
  }, [cocks, chickens, selectedCock, selectedChicken]);

  const handleBreed = async () => {
    if (!selectedCock || !selectedChicken) {
      alert('Please select both a cock and a chicken!');
      return;
    }

    const success = await startBreeding(selectedCock.id, selectedChicken.id);
    if (!success) {
      alert('Cannot breed! Cock or chicken may already be breeding.');
      return;
    }

    // Success - breeding started
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const getRemainingLabel = (timestamp?: number) => {
    if (!timestamp) return null;
    const remaining = timestamp - Date.now();
    if (remaining <= 0) return 'Completing...';
    return formatDuration(remaining);
  };

  const getSessionProgress = (session?: BreedingSession | null) => {
    if (!session) return 0;
    const total = session.completesAt - session.startedAt;
    if (total <= 0) return 0;
    const elapsed = Math.min(total, Math.max(0, Date.now() - session.startedAt));
    return Math.min(100, (elapsed / total) * 100);
  };

  const activeSession = breedingSessions.find((session) => session.status === 'ACTIVE');
  const activeSessionCock = activeSession ? cocks.find((cock) => cock.id === activeSession.cockId) ?? null : null;
  const activeSessionChicken = activeSession ? chickens.find((chicken) => chicken.id === activeSession.chickenId) ?? null : null;
  const breedingRemainingLabel = activeSession
    ? getRemainingLabel(activeSession.completesAt)
    : getRemainingLabel(selectedCock?.breedingEndTime ?? selectedChicken?.breedingEndTime);
  const breedingProgress = getSessionProgress(activeSession ?? null);
  const sortedBreedingSessions = [...breedingSessions].sort((a, b) => b.createdAt - a.createdAt);

  // Check if any breeding is currently happening
  const isBreedingInProgress = Boolean(activeSession) || cocks.some((c) => c.isBreeding) || chickens.some((c) => c.isBreeding);
  
  const availableCocks = cocks.filter(c => !c.isBreeding);
  const availableChickens = chickens.filter(c => !c.isBreeding);
  const scrollCocks = availableCocks.length > 8;
  const scrollChickens = availableChickens.length > 8;
  const {
    containerRef: cockScrollRef,
    isDragging: isCockDrag,
    handlePointerDown: handleCockPointerDown,
    handlePointerMove: handleCockPointerMove,
    handlePointerUp: handleCockPointerUp,
    handlePointerLeave: handleCockPointerLeave,
    handlePointerCancel: handleCockPointerCancel,
  } = useDragScroll(scrollCocks);

  const {
    containerRef: chickenScrollRef,
    isDragging: isChickenDrag,
    handlePointerDown: handleChickenPointerDown,
    handlePointerMove: handleChickenPointerMove,
    handlePointerUp: handleChickenPointerUp,
    handlePointerLeave: handleChickenPointerLeave,
    handlePointerCancel: handleChickenPointerCancel,
  } = useDragScroll(scrollChickens);



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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-12 text-center relative z-[100]">
        <div className="relative inline-block">
          <h2 className="text-4xl font-bold text-white">{t('breeding.title')}</h2>
          <button
            className="group absolute -right-8 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 text-xs text-white/60 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
          >
            !
            {showInfo && (
              <div className="absolute left-1/2 top-8 z-[9999] w-80 -translate-x-1/2 rounded-lg border border-white/20 bg-[#19191E] backdrop-blur-sm p-4 text-left text-sm shadow-xl shadow-black/50">
                <h4 className="mb-2 font-bold text-white">{t('breeding.breedingInfo')}</h4>
                <p className="mb-2 text-white/80">{t('breeding.breedingInfoText')}</p>
              </div>
            )}
          </button>
        </div>
        <p className="mt-2 text-white/60">{t('breeding.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 items-center justify-items-center gap-8 md:grid-cols-3">
        {/* Select Cock */}
        <div className="w-full max-w-sm">
          <h3 className="mb-4 text-center text-2xl font-bold text-white">{t('breeding.selectCock')}</h3>
          <div className="space-y-4">
            {selectedCock ? (
              <div className="flex items-center gap-4 border-2 border-white/10 bg-card-dark p-4">
                <HolographicCard
                  {...getCockHolographicConfig(selectedCock.rarity)}
                  className={`h-24 w-24 flex-shrink-0 overflow-hidden border-2 ${
                  selectedCock.rarity === 'legendary' ? 'border-rarity-legendary' :
                  selectedCock.rarity === 'epic' ? 'border-rarity-epic' :
                  selectedCock.rarity === 'rare' ? 'border-rarity-rare' :
                  selectedCock.rarity === 'uncommon' ? 'border-rarity-uncommon' :
                  'border-rarity-common'
                }`}
                >
                  <img
                    src={getCockImage(selectedCock.image)}
                    alt={`${selectedCock.name} portrait`}
                    className="h-full w-full object-cover"
                  />
                </HolographicCard>
                <div className="flex-grow">
                  <p className="text-lg font-bold text-white">{selectedCock.name}</p>
                  <p className="text-sm text-white/60">
                    Lv. {Math.round((selectedCock.stats.attack + selectedCock.stats.defence + selectedCock.stats.stamina + selectedCock.stats.speed) / 4)}
                  </p>
                  <p className={`text-sm font-bold ${
                    selectedCock.rarity === 'legendary' ? 'text-rarity-legendary' :
                    selectedCock.rarity === 'epic' ? 'text-rarity-epic' :
                    selectedCock.rarity === 'rare' ? 'text-rarity-rare' :
                    selectedCock.rarity === 'uncommon' ? 'text-rarity-uncommon' :
                    'text-rarity-common'
                  }`}>
                    {selectedCock.rarity.charAt(0).toUpperCase() + selectedCock.rarity.slice(1)}
                  </p>
                </div>
                {!selectedCock.isBreeding && !selectedChicken?.isBreeding && (
                  <button 
                    onClick={() => setSelectedCock(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                  >
                    <span className="text-lg leading-none">✕</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center border-2 border-dashed border-white/20 bg-white/5">
                <span className="text-5xl text-white/30">➕</span>
              </div>
            )}
          </div>
        </div>

        {/* Center - Breeding Display */}
        <div className="flex flex-col items-center gap-4 text-center relative z-[1]">
          <div className="flex flex-col items-center gap-2">
            <div className="relative mt-2 h-24 w-24 flex-shrink-0 overflow-hidden rounded-full border-4 border-primary/50">
              {(activeSession || selectedCock?.isBreeding || selectedChicken?.isBreeding) ? (
                <img
                  src="/assets/Items/Egg.png"
                  alt="Breeding Egg"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl">
                  🥚
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-white/60">
              {(activeSession || selectedCock?.isBreeding || selectedChicken?.isBreeding)
                ? `${t('breeding.timeRemaining')}: ${breedingRemainingLabel ?? '—'}`
                : t('breeding.noBreedingInProgress')}
            </p>
          </div>
          <p className="mt-4 max-w-xs text-sm text-white/40">
            {(activeSession || selectedCock?.isBreeding || selectedChicken?.isBreeding)
              ? t('breeding.oneBreedingAtTime')
              : t('breeding.selectToBreed')}
          </p>
          <button 
            onClick={() => void handleBreed()}
            disabled={!selectedCock || !selectedChicken || isBreedingInProgress}
            className="mt-8 flex h-16 w-64 items-center justify-center rounded-xl bg-primary px-8 text-2xl font-bold text-white shadow-lg shadow-primary/30 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none"
          >
            {t('breeding.startBreeding')}
          </button>
        </div>

        {/* Select Chicken */}
        <div className="w-full max-w-sm">
          <h3 className="mb-4 text-center text-2xl font-bold text-white">{t('breeding.selectChicken')}</h3>
          <div className="space-y-4">
            {selectedChicken ? (
              <div className="flex items-center gap-4 border-2 border-white/10 bg-card-dark p-4">
                <HolographicCard
                  {...getCockHolographicConfig(selectedChicken.rarity as Cock['rarity'])}
                  className={`h-24 w-24 flex-shrink-0 overflow-hidden border-2 ${
                  selectedChicken.rarity === 'epic' ? 'border-rarity-epic' :
                  selectedChicken.rarity === 'rare' ? 'border-rarity-rare' :
                  'border-rarity-common'
                }`}
                >
                  <img
                    src={getCockImage(selectedChicken.image)}
                    alt={`${selectedChicken.name} portrait`}
                    className="h-full w-full object-cover"
                  />
                </HolographicCard>
                <div className="flex-grow">
                  <p className="text-lg font-bold text-white">{selectedChicken.name}</p>
                  <p className={`text-sm font-bold ${
                    selectedChicken.rarity === 'epic' ? 'text-rarity-epic' :
                    selectedChicken.rarity === 'rare' ? 'text-rarity-rare' :
                    'text-rarity-common'
                  }`}>
                    {selectedChicken.rarity.charAt(0).toUpperCase() + selectedChicken.rarity.slice(1)}
                  </p>
                </div>
                {!selectedChicken.isBreeding && !selectedCock?.isBreeding && (
                  <button 
                    onClick={() => setSelectedChicken(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                  >
                    <span className="text-lg leading-none">✕</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center border-2 border-dashed border-white/20 bg-white/5">
                <span className="text-5xl text-white/30">➕</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Your Roster */}
      <div className="mt-16 space-y-8">
        {/* Cocks */}
        <div>
          <h3 className="mb-6 text-center text-2xl font-bold text-white">{t('hub.myCocks')}</h3>
          {availableCocks.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center border-2 border-dashed border-white/30 bg-black/20 p-8 text-center">
              <p className="text-sm text-white/60">{t('breeding.noCocksAvailable')}</p>
            </div>
          ) : (
            <div
              ref={cockScrollRef}
              className={scrollCocks
                ? `flex gap-8 scrollbar-hide ${isCockDrag ? 'cursor-grabbing' : 'cursor-default'}`
                : 'grid grid-cols-3 gap-8 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'}
              onPointerDown={handleCockPointerDown}
              onPointerMove={handleCockPointerMove}
              onPointerUp={handleCockPointerUp}
              onPointerLeave={handleCockPointerLeave}
              onPointerCancel={handleCockPointerCancel}
              style={scrollCocks
                ? {
                    touchAction: 'pan-y',
                    userSelect: isCockDrag ? 'none' : 'auto',
                    overflowX: 'auto',
                    padding: '2rem',
                    margin: '-2rem',
                  }
                : { padding: '2rem', margin: '-2rem' }}
            >
              {availableCocks.map((cock) => {
              const rarityColor = cock.rarity === 'legendary' ? 'border-rarity-legendary' : 
                                  cock.rarity === 'epic' ? 'border-rarity-epic' : 
                                  cock.rarity === 'rare' ? 'border-rarity-rare' :
                                  cock.rarity === 'uncommon' ? 'border-rarity-uncommon' :
                                  'border-rarity-common';
              const rarityText = cock.rarity === 'legendary' ? 'text-rarity-legendary' : 
                                 cock.rarity === 'epic' ? 'text-rarity-epic' : 
                                 cock.rarity === 'rare' ? 'text-rarity-rare' : 
                                 cock.rarity === 'uncommon' ? 'text-rarity-uncommon' :
                                 'text-rarity-common';
              const rarityGlow = cock.rarity === 'legendary' ? 'shadow-[0_0_24px_4px_rgba(249,115,22,0.6)]' : 
                                 cock.rarity === 'epic' ? 'shadow-[0_0_20px_4px_rgba(192,132,252,0.5)]' : 
                                 cock.rarity === 'rare' ? 'shadow-[0_0_18px_3px_rgba(59,130,246,0.5)]' :
                                 cock.rarity === 'uncommon' ? 'shadow-[0_0_16px_3px_rgba(34,197,94,0.4)]' :
                                 'shadow-[0_0_14px_2px_rgba(148,163,184,0.3)]';
              const cockImage = getCockImage(cock.image);
              const isSelected = selectedCock?.id === cock.id;

              return (
                <div
                  key={cock.id}
                  onClick={(e) => {
                    if (!isCockDrag && !isBreedingInProgress) {
                      setSelectedCock(cock);
                    }
                  }}
                  style={{ overflow: 'visible' }}
                  className={`relative ${isBreedingInProgress ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} bg-card-dark transition-all duration-200 ${isSelected ? rarityGlow : ''} ${scrollCocks ? 'w-[148px] flex-shrink-0' : ''}`}
                >
                  <HolographicCard
                    {...getCockHolographicConfig(cock.rarity)}
                    className={`relative border-2 ${rarityColor}`}
                    style={{ overflow: 'visible' }}
                  >
                    <div className="relative aspect-square w-full overflow-hidden">
                      <img
                        src={cockImage}
                        alt={`${cock.name} portrait`}
                        className="h-full w-full object-cover"
                        draggable={false}
                        onPointerDown={(e) => e.preventDefault()}
                      />
                      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2">
                      <p className="truncate text-sm font-bold text-white">{cock.name}</p>
                      <div className="flex items-center justify-end text-xs">
                        <span className={`font-semibold capitalize ${rarityText}`}>{cock.rarity}</span>
                      </div>
                    </div>
                  </HolographicCard>
                </div>
              );
              })}
            </div>
          )}
        </div>

        {/* Chickens */}
        <div>
          <h3 className="mb-6 text-center text-2xl font-bold text-white">{t('hub.myChickens')}</h3>
          {availableChickens.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center border-2 border-dashed border-white/30 bg-black/20 p-8 text-center">
              <p className="text-sm text-white/60">{t('breeding.noChickensAvailable')}</p>
            </div>
          ) : (
            <div
              ref={chickenScrollRef}
              className={scrollChickens
                ? `flex gap-8 scrollbar-hide ${isChickenDrag ? 'cursor-grabbing' : 'cursor-default'}`
                : 'grid grid-cols-3 gap-8 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'}
              onPointerDown={handleChickenPointerDown}
              onPointerMove={handleChickenPointerMove}
              onPointerUp={handleChickenPointerUp}
              onPointerLeave={handleChickenPointerLeave}
              onPointerCancel={handleChickenPointerCancel}
              style={scrollChickens
                ? {
                    touchAction: 'pan-y',
                    userSelect: isChickenDrag ? 'none' : 'auto',
                    overflowX: 'auto',
                    padding: '2rem',
                    margin: '-2rem',
                  }
                : { padding: '2rem', margin: '-2rem' }}
            >
              {availableChickens.map((chicken) => {
              const rarityColor = chicken.rarity === 'legendary' ? 'border-rarity-legendary' : 
                                  chicken.rarity === 'epic' ? 'border-rarity-epic' : 
                                  chicken.rarity === 'rare' ? 'border-rarity-rare' :
                                  chicken.rarity === 'uncommon' ? 'border-rarity-uncommon' : 
                                  'border-rarity-common';
              const rarityText = chicken.rarity === 'legendary' ? 'text-rarity-legendary' : 
                                 chicken.rarity === 'epic' ? 'text-rarity-epic' : 
                                 chicken.rarity === 'rare' ? 'text-rarity-rare' :
                                 chicken.rarity === 'uncommon' ? 'text-rarity-uncommon' : 
                                 'text-rarity-common';
              const rarityGlow = chicken.rarity === 'legendary' ? 'shadow-[0_0_24px_4px_rgba(249,115,22,0.6)]' : 
                                 chicken.rarity === 'epic' ? 'shadow-[0_0_20px_4px_rgba(192,132,252,0.5)]' : 
                                 chicken.rarity === 'rare' ? 'shadow-[0_0_18px_3px_rgba(59,130,246,0.5)]' :
                                 chicken.rarity === 'uncommon' ? 'shadow-[0_0_16px_3px_rgba(34,197,94,0.4)]' : 
                                 'shadow-[0_0_14px_2px_rgba(148,163,184,0.3)]';
              const chickenImage = getCockImage(chicken.image);
              const isSelected = selectedChicken?.id === chicken.id;
              
              return (
                <div 
                  key={chicken.id}
                  onClick={(e) => {
                    if (!isChickenDrag && !isBreedingInProgress) {
                      setSelectedChicken(chicken);
                    }
                  }}
                  style={{ overflow: 'visible' }}
                  className={`relative ${isBreedingInProgress ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} bg-card-dark transition-all duration-200 ${isSelected ? rarityGlow : ''} ${scrollChickens ? 'w-[148px] flex-shrink-0' : ''}`}
                >
                  <HolographicCard
                    {...getCockHolographicConfig(chicken.rarity as Cock['rarity'])}
                    className={`relative border-2 ${rarityColor}`}
                    style={{ overflow: 'visible' }}
                  >
                    <div className="relative aspect-square w-full overflow-hidden">
                      <img
                        src={chickenImage}
                        alt={`${chicken.name} portrait`}
                        className="h-full w-full object-cover"
                        draggable={false}
                        onPointerDown={(e) => e.preventDefault()}
                      />
                      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2">
                      <p className="truncate text-sm font-bold text-white">{chicken.name}</p>
                      <div className="flex items-center justify-end text-xs">
                        <span className={`font-semibold capitalize ${rarityText}`}>{chicken.rarity}</span>
                      </div>
                    </div>
                  </HolographicCard>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Breeding;
