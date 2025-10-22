import { useState, useEffect } from 'react';
import { useGameStore, BACKEND_ENABLED } from '../store/gameStore';
import { Egg, Cock } from '../types';
import { calculateMaxEnergy } from '../utils/combatSystem';
import { getRandomCockByRarity } from '../data/cocks';
import { calculateOffspringRarity } from '../utils/breedingSystem';
import HolographicCard from './ui/HolographicCard';
import { getCockImage } from '../utils/cockImages';
import { getCockHolographicConfig } from '../utils/cockHoloStyles';

const EggIncubator = () => {
  const {
    eggs,
    cocks,
    chickens,
    addCock,
    updateEgg,
    removeEgg,
    startEggIncubation,
    hatchEggAction,
  } = useGameStore();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [hatchedCock, setHatchedCock] = useState<Cock | null>(null);
  const [showHatchModal, setShowHatchModal] = useState(false);
  
  const incubatingEgg = eggs.find((e) => e.isIncubating);
  const readyEggs = eggs.filter((e) => !e.isIncubating && e.status === 'READY_TO_HATCH');
  const availableEggs = eggs.filter((e) => !e.isIncubating && e.status === 'FRESH');
  const incubatorProgress = (() => {
    if (!incubatingEgg) return 0;
    const totalDuration = incubatingEgg.readyAt && incubatingEgg.incubationStartTime
      ? incubatingEgg.readyAt - incubatingEgg.incubationStartTime
      : incubatingEgg.hatchTime;
    if (!totalDuration || totalDuration <= 0) {
      return 0;
    }
    const elapsed = Math.max(0, Math.min(totalDuration, totalDuration - timeRemaining));
    return Math.min(100, (elapsed / totalDuration) * 100);
  })();
  
  useEffect(() => {
    if (!incubatingEgg) {
      setTimeRemaining(0);
      return;
    }

    const targetTime = incubatingEgg.readyAt
      ? incubatingEgg.readyAt
      : incubatingEgg.incubationStartTime
        ? incubatingEgg.incubationStartTime + incubatingEgg.hatchTime
        : null;

    if (!targetTime) {
      setTimeRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, targetTime - Date.now());
      setTimeRemaining(remaining);

      if (!BACKEND_ENABLED && remaining === 0) {
        void handleHatch(incubatingEgg);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [incubatingEgg, incubatingEgg?.readyAt, incubatingEgg?.incubationStartTime, incubatingEgg?.hatchTime]);
  
  const handleIncubate = async (egg: Egg) => {
    if (incubatingEgg) return;

    if (BACKEND_ENABLED) {
      try {
        await startEggIncubation(egg.id);
      } catch (error) {
        console.error('Failed to start egg incubation', error);
      }
      return;
    }

    const hatchDuration = egg.hatchTime && egg.hatchTime > 0 ? egg.hatchTime : 48 * 60 * 60 * 1000;
    const startedAt = Date.now();

    void updateEgg(egg.id, {
      isIncubating: true,
      incubationStartTime: startedAt,
      hatchTime: hatchDuration,
      status: 'INCUBATING',
      readyAt: startedAt + hatchDuration,
    });
  };
  
  const handleHatch = async (egg: Egg) => {
    if (BACKEND_ENABLED) {
      try {
        const result = await hatchEggAction(egg.id);
        if (result) {
          setHatchedCock(result);
          setShowHatchModal(true);
        }
      } catch (error) {
        console.error('Failed to hatch egg', error);
      }
      return;
    }

    const { cocks, chickens } = useGameStore.getState();
    
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
    
    // Get current cock count for sequential numbering
    const cockNumber = cocks.length + 1;
    
    const fixedStats = {
      attack: 40,
      defence: 40,
      stamina: 40,
      speed: 40,
    };

    const maxEnergy = calculateMaxEnergy(fixedStats.stamina, rarity);

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
      isBreeding: false,
      lastRestTimestamp: Date.now(),
    };
    
    addCock(newCock);
    removeEgg(egg.id);
    setHatchedCock(newCock);
    setShowHatchModal(true);
  };
  
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <div className="card">
      <div className="aspect-square bg-gradient-to-br from-primary-900 to-gray-800 flex flex-col items-center justify-center mb-4 relative overflow-hidden">
        {incubatingEgg ? (
          <>
            <div className="text-6xl animate-pulse">🥚</div>
            <div className="mt-4 text-center">
              <p className="text-gray-300">Incubating...</p>
              <p className="text-2xl font-bold text-primary-400">
                {formatTime(timeRemaining)}
              </p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-700">
              <div
                className="h-full bg-primary-500 transition-all"
                style={{
                  width: `${incubatorProgress}%`,
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">🔥</div>
            <p className="text-gray-400">Empty Incubator</p>
          </>
        )}
      </div>
      
      {!incubatingEgg && readyEggs.length > 0 && (
        <div className="mb-6">
          <p className="text-sm text-emerald-300 mb-2">Ready to hatch:</p>
          <div className="grid grid-cols-3 gap-2">
            {readyEggs.map((egg) => (
              <button
                key={egg.id}
                onClick={() => void handleHatch(egg)}
                className="aspect-square rounded border border-emerald-400/60 bg-emerald-600/10 text-3xl text-emerald-200 transition-colors hover:bg-emerald-500/20"
              >
                🥚
              </button>
            ))}
          </div>
        </div>
      )}

      {!incubatingEgg && availableEggs.length > 0 && (
        <div>
          <p className="text-sm text-gray-400 mb-2">Available Eggs:</p>
          <div className="grid grid-cols-3 gap-2">
            {availableEggs.map((egg) => (
              <button
                key={egg.id}
                onClick={() => void handleIncubate(egg)}
                className="aspect-square bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-3xl transition-colors"
              >
                🥚
              </button>
            ))}
          </div>
        </div>
      )}
      
      {!incubatingEgg && eggs.length === 0 && (
        <p className="text-center text-gray-400 text-sm">
          Get eggs from breeding or the shop!
        </p>
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
            className="relative w-full max-w-3xl border border-white/10 bg-card-dark shadow-lg shadow-primary/20 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="absolute right-4 top-4 text-white/60 transition-colors hover:text-white" 
              onClick={() => {
                setShowHatchModal(false);
                setHatchedCock(null);
              }}
            >
              <span className="text-3xl">×</span>
            </button>

            <div className="p-8">
              <div className="flex items-start gap-8">
                <HolographicCard
                  {...getCockHolographicConfig(hatchedCock.rarity)}
                  className={`relative h-56 w-56 flex-shrink-0 overflow-hidden border-4 ${
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                </HolographicCard>

                <div className="flex-1 space-y-4 pt-2">
                  <div className="mb-4">
                    <div className="inline-block rounded-full bg-primary/20 border border-primary/50 px-3 py-1 mb-3">
                      <span className="text-sm font-bold text-primary">Egg Hatched!</span>
                    </div>
                    <h2 className="text-4xl font-bold text-white">{hatchedCock.name}</h2>
                    <p className={`text-sm font-semibold uppercase tracking-wider mt-1 ${
                      hatchedCock.rarity === 'legendary' ? 'text-rarity-legendary' :
                      hatchedCock.rarity === 'epic' ? 'text-rarity-epic' :
                      hatchedCock.rarity === 'rare' ? 'text-rarity-rare' :
                      hatchedCock.rarity === 'uncommon' ? 'text-rarity-uncommon' :
                      'text-rarity-common'
                    }`}>
                      {hatchedCock.rarity}
                    </p>
                  </div>

                  <div className="border-t border-white/10 pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between rounded border border-white/10 bg-black/20 p-3">
                        <span className="text-sm font-bold text-white/80">Attack</span>
                        <span className="text-xl font-bold text-white">{hatchedCock.stats.attack}</span>
                      </div>
                      <div className="flex items-center justify-between rounded border border-white/10 bg-black/20 p-3">
                        <span className="text-sm font-bold text-white/80">Defence</span>
                        <span className="text-xl font-bold text-white">{hatchedCock.stats.defence}</span>
                      </div>
                      <div className="flex items-center justify-between rounded border border-white/10 bg-black/20 p-3">
                        <span className="text-sm font-bold text-white/80">Stamina</span>
                        <span className="text-xl font-bold text-white">{hatchedCock.stats.stamina}</span>
                      </div>
                      <div className="flex items-center justify-between rounded border border-white/10 bg-black/20 p-3">
                        <span className="text-sm font-bold text-white/80">Speed</span>
                        <span className="text-xl font-bold text-white">{hatchedCock.stats.speed}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => {
                        setShowHatchModal(false);
                        setHatchedCock(null);
                      }}
                      className="w-full rounded bg-primary py-3 font-bold text-white transition-all hover:brightness-110"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EggIncubator;