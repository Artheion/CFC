import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HolographicCard from '../components/ui/HolographicCard';
import { useGameStore } from '../store/gameStore';
import { Cock, ActiveFight, FightRound } from '../types';
import CockfightArena from '../3d/CockfightArena';
import CockStatsModal from '../components/CockStatsModal';
import BettingModal from '../components/BettingModal';
import { calculateEnergyCost, getEnergyStats } from '../utils/combatSystem';
import { getCockImage } from '../utils/cockImages';
import { getCockHolographicConfig } from '../utils/cockHoloStyles';
import { formatWalletAddress } from '../utils/formatAddress';
import { useWalletContext } from '../contexts/WalletContext';
import { useWalletBalance } from '../hooks/useWalletBalance';
import { useEscrowContract } from '../hooks/useEscrowContract';
import { formatCFC } from '../utils/formatNumber';
import NetworkMismatchNotice from '../components/NetworkMismatchNotice';
import { hasValidAuth, authenticateWithWallet } from '../utils/apiClient';
// WebSocket removed - using polling for fight updates

const Spectate = () => {
  const { t } = useTranslation();
  const { fightId } = useParams();
  const navigate = useNavigate();
  const { cocks, user, getFightById, placeBet, updateFightById, updateBNBBalance, updateCock, refreshBackendState } = useGameStore();
  const { address, isCorrectNetwork, provider } = useWalletContext();
  const { cfcBalance } = useWalletBalance();
  const { placeBet: placeBetOnContract, loading: escrowLoading, error: escrowError, isConfigured: escrowConfigured } = useEscrowContract();
  
  const [selectedWinner, setSelectedWinner] = useState<string>('');
  const [betAmount, setBetAmount] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [fightPhase, setFightPhase] = useState<'betting' | 'round1' | 'delay1' | 'round2' | 'delay2' | 'round3' | 'finished'>('betting');
  const [arenaPhase, setArenaPhase] = useState<'idle' | 'facing' | 'fighting' | 'between' | 'finished'>('idle');
  const [arenaCountdown, setArenaCountdown] = useState<number | null>(null);
  const [knockoutInfo, setKnockoutInfo] = useState<{ winnerId: string; loserId: string } | null>(null);
  const [selectedCockForModal, setSelectedCockForModal] = useState<Cock | null>(null);
  
  // Animation state - separate from backend data
  const [animatedRounds, setAnimatedRounds] = useState<FightRound[]>([]);
  const [currentAnimatedRound, setCurrentAnimatedRound] = useState(0);
  const [displayHealth, setDisplayHealth] = useState<{ cock1: number; cock2: number }>({ cock1: 100, cock2: 100 });
  const [animationStarted, setAnimationStarted] = useState(false);
  const initialFightStatusRef = useRef<string | null>(null);
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({ 
    isOpen: false, 
    title: '', 
    message: '', 
    type: 'info' 
  });

  if (address && !isCorrectNetwork) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <NetworkMismatchNotice fullScreen />
      </div>
    );
  }

  const fight = getFightById(fightId || '');
  
  // Try to get cocks from fight data first (includes opponent data), fallback to local cocks
  const cock1 = fight?.cock1 || cocks.find(c => c.id === fight?.cock1Id);
  const cock2 = fight?.cock2 || cocks.find(c => c.id === fight?.cock2Id);
  


  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Start animating a specific round
  const startRound = (roundNumber: number) => {
    if (!fight || !cock1 || !cock2 || !fight.rounds) return;

    // Get backend round (the source of truth!)
    const backendRound = fight.rounds[roundNumber - 1];
    if (!backendRound) {
      console.error(`[Animation] No backend round found for round ${roundNumber}`);
      // If all rounds animated, complete the fight
      if (roundNumber > fight.rounds.length) {
        completeFightAnimation();
      }
      return;
    }

    console.log(`[Animation] Animating Round ${roundNumber} (winner: ${backendRound.winnerId === cock1.id ? cock1.name : cock2.name})`);

    // Reset display health to 100 for new round
    setDisplayHealth({ cock1: 100, cock2: 100 });
    setCurrentAnimatedRound(roundNumber);

    // Facing phase - 5 second countdown
    setArenaPhase('facing');
    setArenaCountdown(5);
    setKnockoutInfo(null);
    setFightPhase(`round${roundNumber}` as any);

    let countdown = 5;
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown >= 1) {
        setArenaCountdown(countdown);
      } else {
        clearInterval(countdownInterval);
        setArenaCountdown(null);
      }
    }, 1000);

    // Start animating health bars after 5 seconds
    setTimeout(() => {
      setArenaPhase('fighting');
      clearInterval(countdownInterval);
      setArenaCountdown(null);

      // Animate health bars smoothly to backend values
      let currentCock1Health = 100;
      let currentCock2Health = 100;
      const targetCock1Health = backendRound.cock1Health;
      const targetCock2Health = backendRound.cock2Health;

      // Calculate animation parameters
      const cock1HealthDrop = 100 - targetCock1Health;
      const cock2HealthDrop = 100 - targetCock2Health;
      const maxHealthDrop = Math.max(cock1HealthDrop, cock2HealthDrop);
      const animationDuration = Math.max(15000, maxHealthDrop * 150); // At least 15 seconds
      const updateInterval = 150;
      const stepsNeeded = Math.ceil(animationDuration / updateInterval);
      const cock1HealthDropPerStep = cock1HealthDrop / stepsNeeded;
      const cock2HealthDropPerStep = cock2HealthDrop / stepsNeeded;

      let currentStep = 0;
      const animationInterval = setInterval(() => {
        currentStep++;

        // Gradually decrease health to match backend result
        currentCock1Health = Math.max(targetCock1Health, 100 - (cock1HealthDropPerStep * currentStep));
        currentCock2Health = Math.max(targetCock2Health, 100 - (cock2HealthDropPerStep * currentStep));

        setDisplayHealth({
          cock1: Math.round(currentCock1Health),
          cock2: Math.round(currentCock2Health),
        });

        // Animation complete when both reach target values
        if (currentCock1Health <= targetCock1Health && currentCock2Health <= targetCock2Health) {
          clearInterval(animationInterval);

          // Use backend winner
          const roundWinnerId = backendRound.winnerId;
          const roundLoserId = roundWinnerId === cock1.id ? cock2.id : cock1.id;

          // Show knockout animation
          setKnockoutInfo({ winnerId: roundWinnerId, loserId: roundLoserId });
          setArenaPhase('between');

          // Add round to animated rounds
          const completedRound: FightRound = {
            roundNumber,
            winnerId: roundWinnerId,
            cock1Damage: Math.round(100 - targetCock1Health),
            cock2Damage: Math.round(100 - targetCock2Health),
            cock1Health: targetCock1Health,
            cock2Health: targetCock2Health,
          };

          setAnimatedRounds(prev => [...prev, completedRound]);

          // Calculate wins
          const allRounds = [...animatedRounds, completedRound];
          const cock1Wins = allRounds.filter(r => r.winnerId === cock1.id).length;
          const cock2Wins = allRounds.filter(r => r.winnerId === cock2.id).length;

          console.log(`[Animation] Round ${roundNumber} winner: ${roundWinnerId === cock1.id ? cock1.name : cock2.name}`);
          console.log(`[Animation] Score: ${cock1.name} ${cock1Wins} - ${cock2Wins} ${cock2.name}`);

          // Check if fight is over (best of 3 - first to 2 wins)
          if (cock1Wins >= 2 || cock2Wins >= 2 || roundNumber >= fight.rounds.length) {
            console.log('[Animation] Fight complete!');
            setTimeout(() => {
              setArenaPhase('finished');
              setFightPhase('finished');
              completeFightAnimation();
            }, 3000);
          } else {
            // Continue to next round
            setTimeout(() => {
              startRound(roundNumber + 1);
            }, 3000);
          }
        }
      }, updateInterval);
    }, 5000); // 5 second countdown
  };

  // ✅ Notify backend that animations are complete
  const completeFightAnimation = async () => {
    if (!fightId) return;
    
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
    
    try {
      console.log('[Spectate] ✅ Notifying backend fight animations complete...');
      await fetch(`${apiBase}/fights/${fightId}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      
      // Refresh to get winner
      await refreshBackendState();
    } catch (error) {
      console.error('[Spectate] ❌ Error completing fight:', error);
    }
  };

  // ✅ Initialize arena state based on fight status
  useEffect(() => {
    if (!fight || !cock1 || !cock2) return;

    if (fight.status === 'betting') {
      console.log('[Spectate] Fight in betting phase');
      setArenaPhase('idle');
      setFightPhase('betting');
      setAnimatedRounds([]);
      setCurrentAnimatedRound(0);
      setDisplayHealth({ cock1: 100, cock2: 100 });
      setAnimationStarted(false);
    } else if ((fight.status === 'fighting' || fight.status === 'finished') && fight.rounds && fight.rounds.length > 0) {
      // Animate rounds when backend simulation is complete
      if (!animationStarted) {
        console.log('[Spectate] Fight rounds ready - starting animation');
        setAnimationStarted(true);
        startRound(1);
      }
    }
  }, [fight?.status, fight?.rounds?.length, animationStarted, cock1, cock2]);

  // Removed - using polling instead

  // Removed WebSocket round start handler
  /*useEffect(() => {
    if (!roundStart) return;
    
    console.log('[Spectate] ⚔️  Round starting:', roundStart.roundNumber);
    setCurrentAnimatedRound(roundStart.roundNumber);
    setArenaPhase('facing');
    setArenaCountdown(5);
    setKnockoutInfo(null);
    setFightPhase(`round${roundStart.roundNumber}` as any);
    
    // Countdown animation
    let countdown = 5;
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown >= 1) {
        setArenaCountdown(countdown);
      } else {
        clearInterval(countdownInterval);
        setArenaCountdown(null);
        setArenaPhase('fighting');
      }
    }, 1000);
    
    return () => clearInterval(countdownInterval);
  }, [roundStart]);*/

  // Removed - using polling instead
  /*useEffect(() => {
    if (!roundComplete || !cock1 || !cock2) return;
    
    console.log('[Spectate] ✅ Round complete:', roundComplete);
    
    // Animate health bars to final values
    let currentCock1Health = displayHealth.cock1;
    let currentCock2Health = displayHealth.cock2;
    const targetCock1Health = roundComplete.cock1Health;
    const targetCock2Health = roundComplete.cock2Health;
    
    const animationDuration = 20000; // 20 seconds
    const updateInterval = 150;
    const stepsNeeded = Math.ceil(animationDuration / updateInterval);
    const cock1HealthStep = (currentCock1Health - targetCock1Health) / stepsNeeded;
    const cock2HealthStep = (currentCock2Health - targetCock2Health) / stepsNeeded;
    
    let currentStep = 0;
    const animationInterval = setInterval(() => {
      currentStep++;
      
      currentCock1Health = Math.max(targetCock1Health, currentCock1Health - cock1HealthStep);
      currentCock2Health = Math.max(targetCock2Health, currentCock2Health - cock2HealthStep);
      
      setDisplayHealth({
        cock1: Math.round(currentCock1Health),
        cock2: Math.round(currentCock2Health),
      });
      
      if (currentCock1Health <= targetCock1Health && currentCock2Health <= targetCock2Health) {
        clearInterval(animationInterval);
        
        // Show knockout animation
        setKnockoutInfo({
          winnerId: roundComplete.winnerId,
          loserId: roundComplete.winnerId === cock1.id ? cock2.id : cock1.id,
        });
        setArenaPhase('between');
        
        // Add round to history
        setAnimatedRounds(prev => [...prev, {
          roundNumber: roundComplete.roundNumber,
          winnerId: roundComplete.winnerId,
          cock1Damage: roundComplete.cock1Damage,
          cock2Damage: roundComplete.cock2Damage,
          cock1Health: roundComplete.cock1Health,
          cock2Health: roundComplete.cock2Health,
        }]);
      }
    }, updateInterval);
    
    return () => clearInterval(animationInterval);
  }, [roundComplete, cock1, cock2, displayHealth]);*/

  // Removed - using polling instead

  // Removed - no WebSocket

  // Note: Fight progression controlled by backend, frontend just displays current state

  // Calculate mutual parley odds
  const calculateOdds = () => {
    if (!fight) return { cock1: 1.5, cock2: 1.5 };

    const cock1Bets = fight.spectatorBets.filter(b => b.cockId === cock1?.id).reduce((sum, b) => sum + b.amount, 0);
    const cock2Bets = fight.spectatorBets.filter(b => b.cockId === cock2?.id).reduce((sum, b) => sum + b.amount, 0);
    const totalBets = cock1Bets + cock2Bets;

    if (totalBets === 0) return { cock1: 2.0, cock2: 2.0 };

    // Mutual parley odds = total pool / amount bet on that side
    const cock1Odds = totalBets / (cock1Bets || 1);
    const cock2Odds = totalBets / (cock2Bets || 1);

    return {
      cock1: Math.max(1.1, Math.min(10, cock1Odds)).toFixed(2),
      cock2: Math.max(1.1, Math.min(10, cock2Odds)).toFixed(2),
    };
  };

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setModalConfig({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModalConfig({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const handlePlaceBet = async () => {
    if (!selectedWinner || !betAmount || !fight) {
      showModal(t('spectate.missingInfo'), t('spectate.pleaseSelectWinner'), 'warning');
      return;
    }

    // Check authentication status before proceeding
    if (!hasValidAuth()) {
      // Try to authenticate
      if (provider && address) {
        try {

          showModal('Authenticating', 'Authenticating with backend...', 'info');
          
          await authenticateWithWallet(provider);
          

          closeModal();
          
          // Give a small delay for token to be fully persisted
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Retry the bet placement by calling this function again
          return handlePlaceBet();
        } catch (authError) {
          showModal(
            'Authentication Required',
            'Authentication required to place bets.\n\nPlease ensure you are connected to the correct network and try again.\n\nIf the issue persists, try disconnecting and reconnecting your wallet.',
            'error'
          );
          return;
        }
      } else {
        showModal('Wallet Not Connected', 'Please connect your wallet before placing a bet.', 'error');
        return;
      }
    }

    // Check if user has already placed a bet on this fight
    const existingBet = fight.spectatorBets.find(bet => bet.userId === user?.walletAddress);
    if (existingBet) {
      if (existingBet.cockId !== selectedWinner) {
        showModal(t('spectate.alreadyBet'), t('spectate.cannotBetBothSides'), 'error');
        return;
      } else {
        showModal(t('spectate.alreadyBet'), t('spectate.alreadyPlacedBet'), 'warning');
        return;
      }
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < 1000) {
      showModal(t('spectate.invalidAmount'), t('spectate.minimumBet'), 'warning');
      return;
    }

    const cfcBalanceNum = parseFloat(cfcBalance?.formatted || '0');
    if (!user || cfcBalanceNum < amount) {
      showModal(t('spectate.insufficientBalance'), `Need ${formatCFC(amount)} $CFC but only have ${formatCFC(cfcBalanceNum)} $CFC`, 'error');
      return;
    }

    if (!provider || !address) {
      showModal('Wallet Not Connected', 'Please connect your wallet first.', 'error');
      return;
    }

    if (!escrowConfigured) {
      showModal('Contract Not Configured', 'Escrow contract not configured. Please contact support.', 'error');
      return;
    }

    try {
      // Determine player choice (1 or 2)
      const playerChoice = selectedWinner === fight.cock1Id ? 1 : 2;

      // Call escrow contract to place bet
      const result = await placeBetOnContract({
        matchId: fight.id,
        playerChoice,
        amount: amount.toString(),
      });

      if (!result.success) {
        const errorMsg = escrowError || 'Failed to place bet on contract';
        showModal('Bet Failed', errorMsg, 'error');
        return;
      }



      // Now update backend with the bet and transaction hash
      const success = await placeBet(fight.id, selectedWinner, amount, result.txHash);
      if (success) {
        showModal(t('spectate.betPlaced'), `${t('spectate.successfullyBet', { amount: formatCFC(amount), name: cocks.find(c => c.id === selectedWinner)?.name })}`, 'success');
        setBetAmount('');
        setSelectedWinner('');
      } else {
        showModal(t('spectate.betFailed'), 'Bet escrowed on contract but failed to save in database. Please contact support with txHash: ' + result.txHash, 'error');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      showModal('Bet Failed', message, 'error');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeRemaining = () => {
    if (!fight?.bettingEndTime) return 0;
    return Math.max(0, Math.floor((fight.bettingEndTime - currentTime) / 1000));
  };

  if (!fight || !cock1 || !cock2) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-dark">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">{t('spectate.fightNotFound')}</h2>
          <button 
            onClick={() => navigate('/arena')}
            className="mt-4 bg-primary px-6 py-3 text-white hover:opacity-90"
          >
            {t('spectate.backToArena')}
          </button>
        </div>
      </div>
    );
  }

  const odds = calculateOdds();
  const timeRemaining = getTimeRemaining();
  const isBettingPhase = fight.status === 'betting' && timeRemaining > 0;
  
  // Use animated rounds for display (not backend rounds until animation finishes)
  const displayRounds = arenaPhase === 'finished' ? fight.rounds : animatedRounds;
  const cock1RoundWins = displayRounds.filter(r => r.winnerId === cock1.id).length;
  const cock2RoundWins = displayRounds.filter(r => r.winnerId === cock2.id).length;
  const currentRoundNumber = currentAnimatedRound || 1;

  return (
    <div className="min-h-screen bg-background-dark">
      {/* Fight Info Header */}
      <div className="border-b border-white/10 bg-background-dark/80 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => navigate('/arena')}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <span>←</span>
              <span>{t('spectate.backToArena')}</span>
            </button>

            {/* ✅ Winner Announcement */}
            {fight.status === 'finished' && fight.winnerId && (
              <div className="bg-primary/20 border-2 border-primary px-6 py-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/80">WINNER:</span>
                  <span className="text-2xl font-bold text-primary">
                    {fight.winnerId === cock1?.id ? cock1.name : cock2?.name}
                  </span>
                  <span className="text-3xl">🏆</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-start justify-between gap-8">
            {/* Cock 1 */}
            <div className="w-1/3 bg-card-dark p-4">
              <div className="flex items-center gap-4">
                <HolographicCard
                  {...getCockHolographicConfig(cock1.rarity)}
                  className={`relative h-16 w-16 flex-shrink-0 overflow-hidden border-2 cursor-pointer transition-transform hover:scale-110 ${
                    fight.status === 'finished' && fight.winnerId === cock1.id 
                      ? 'ring-4 ring-primary shadow-lg shadow-primary/50' 
                      : ''
                  } ${
                    cock1.rarity === 'legendary' ? 'border-rarity-legendary' :
                    cock1.rarity === 'epic' ? 'border-rarity-epic' :
                    cock1.rarity === 'rare' ? 'border-rarity-rare' :
                    cock1.rarity === 'uncommon' ? 'border-rarity-uncommon' :
                    'border-rarity-common'
                  }`}
                  onClick={() => setSelectedCockForModal(cock1)}
                >
                  <img
                    src={getCockImage(cock1.image)}
                    alt={`${cock1.name} portrait`}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </HolographicCard>
                <div>
                  <p className={`text-lg font-bold ${
                    fight.status === 'finished' && fight.winnerId === cock1.id 
                      ? 'text-primary' 
                      : 'text-white'
                  }`}>
                    {cock1.name}
                  </p>
                  {fight.status === 'finished' && fight.winnerId === cock1.id && (
                    <p className="text-xs text-primary font-bold">WINNER</p>
                  )}
                  <p className={`text-sm ${
                    cock1.rarity === 'legendary' ? 'text-rarity-legendary' :
                    cock1.rarity === 'epic' ? 'text-rarity-epic' :
                    cock1.rarity === 'rare' ? 'text-rarity-rare' :
                    'text-rarity-common'
                  }`}>
                    {cock1.rarity.charAt(0).toUpperCase() + cock1.rarity.slice(1)}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-4 w-full rounded-full border border-white/20 bg-background-dark">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${displayHealth.cock1}%` }}></div>
              </div>
              <p className="mt-1 text-right text-sm font-bold text-white">{displayHealth.cock1}/100 {t('spectate.hp')}</p>
            </div>

            {/* Timer & Round */}
            <div className="flex flex-col items-center gap-3 pt-4 text-white">
              {isBettingPhase ? (
                <>
                  <p className="text-sm text-white/60">{t('spectate.bettingPhase')}</p>
                  <div className="text-5xl font-bold text-primary">{formatTime(timeRemaining)}</div>
                  <p className="text-sm text-white/60">{t('spectate.placeYourBets')}</p>
                </>
              ) : arenaPhase === 'finished' ? (
                <>
                  <div className="text-sm uppercase tracking-[0.3em] text-white/50">FINAL SCORE</div>
                  <div className="text-6xl font-black text-white">{cock1RoundWins} - {cock2RoundWins}</div>
                  <p className="text-2xl font-bold text-primary mt-2">FIGHT OVER!</p>
                  <p className="text-3xl font-black text-white mt-4">
                    WINNER: {fight.winnerId === cock1.id ? cock1.name : cock2.name}
                  </p>
                </>
              ) : fightPhase.startsWith('delay') ? (
                <>
                  <p className="text-sm text-white/60">{t('spectate.roundComplete')}</p>
                  <div className="text-3xl font-bold text-primary">{t('spectate.nextRoundStarting')}</div>
                  <p className="text-sm text-white/60">{t('spectate.getReady')}</p>
                </>
              ) : (
                <>
                  <div className="text-sm uppercase tracking-[0.3em] text-white/50">{t('spectate.round')} {currentRoundNumber}</div>
                  <div className="text-6xl font-black text-white">{cock1RoundWins} - {cock2RoundWins}</div>
                </>
              )}
            </div>

            {/* Cock 2 */}
            <div className="w-1/3 bg-card-dark p-4 text-right">
              <div className="flex items-center justify-end gap-4">
                <div>
                  <p className={`text-lg font-bold ${
                    fight.status === 'finished' && fight.winnerId === cock2.id 
                      ? 'text-primary' 
                      : 'text-white'
                  }`}>
                    {cock2.name}
                  </p>
                  {fight.status === 'finished' && fight.winnerId === cock2.id && (
                    <p className="text-xs text-primary font-bold">WINNER</p>
                  )}
                  <p className={`text-sm ${
                    cock2.rarity === 'legendary' ? 'text-rarity-legendary' :
                    cock2.rarity === 'epic' ? 'text-rarity-epic' :
                    cock2.rarity === 'rare' ? 'text-rarity-rare' :
                    'text-rarity-common'
                  }`}>
                    {cock2.rarity.charAt(0).toUpperCase() + cock2.rarity.slice(1)}
                  </p>
                </div>
                <HolographicCard
                  {...getCockHolographicConfig(cock2.rarity)}
                  className={`relative h-16 w-16 flex-shrink-0 overflow-hidden border-2 cursor-pointer transition-transform hover:scale-110 ${
                    fight.status === 'finished' && fight.winnerId === cock2.id 
                      ? 'ring-4 ring-primary shadow-lg shadow-primary/50' 
                      : ''
                  } ${
                    cock2.rarity === 'legendary' ? 'border-rarity-legendary' :
                    cock2.rarity === 'epic' ? 'border-rarity-epic' :
                    cock2.rarity === 'rare' ? 'border-rarity-rare' :
                    cock2.rarity === 'uncommon' ? 'border-rarity-uncommon' :
                    'border-rarity-common'
                  }`}
                  onClick={() => setSelectedCockForModal(cock2)}
                >
                  <img
                    src={getCockImage(cock2.image)}
                    alt={`${cock2.name} portrait`}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </HolographicCard>
              </div>
              <div className="mt-4 h-4 w-full rounded-full border border-white/20 bg-background-dark">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${displayHealth.cock2}%` }}></div>
              </div>
              <p className="mt-1 text-left text-sm font-bold text-white">{displayHealth.cock2}/100 {t('spectate.hp')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3D Arena Visualization */}
      <div className="relative h-[60vh] w-full border-y border-white/10 bg-black">
        <CockfightArena
          cock1={cock1}
          cock2={cock2}
          phase={arenaPhase}
          cock1Health={displayHealth.cock1}
          cock2Health={displayHealth.cock2}
          knockoutInfo={knockoutInfo}
          countdown={arenaCountdown}
        />
      </div>

      {/* Predictions & Betting Section */}
      <div className="bg-background-dark py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Live Predictions */}
            <div className="lg:col-span-2">
              <div className="h-full bg-card-dark p-6 shadow-lg">
                <h2 className="mb-4 text-2xl font-bold text-white">{t('spectate.betsPlaced')}</h2>
                <div className="space-y-4">
                  {/* Header */}
                  <div className="grid grid-cols-3 gap-4 border-b border-white/10 pb-2 text-sm font-medium text-white/60">
                    <div>{t('spectate.user')}</div>
                    <div className="text-center">{t('spectate.predictedWinner')}</div>
                    <div className="text-right">{t('spectate.wagerBNB')}</div>
                  </div>

                  {/* Predictions List */}
                  {fight.spectatorBets.length > 0 ? (
                    fight.spectatorBets.map((bet, index) => {
                      // ✅ FIX: Use cocks from the fight (cock1/cock2), not from user's cocks array
                      const bettedCock = bet.cockId === cock1?.id ? cock1 : bet.cockId === cock2?.id ? cock2 : null;
                      const displayName = bet.username || formatWalletAddress(bet.userId);
                      const avatarInitials = bet.username 
                        ? bet.username.substring(0, 2).toUpperCase()
                        : bet.userId.substring(0, 2).toUpperCase();
                      return (
                        <div key={index} className="grid grid-cols-3 items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-xs">
                              {avatarInitials}
                            </div>
                            <span className="text-white truncate">{displayName}</span>
                          </div>
                          <div className={`text-center font-bold ${
                            bettedCock?.rarity === 'legendary' ? 'text-rarity-legendary' :
                            bettedCock?.rarity === 'epic' ? 'text-rarity-epic' :
                            bettedCock?.rarity === 'rare' ? 'text-rarity-rare' :
                            'text-white'
                          }`}>
                            {bettedCock?.name || 'Unknown'}
                          </div>
                          <div className="text-right font-bold text-white">{formatCFC(bet.amount)} $CFC</div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center text-white/60 py-8">{t('spectate.noBetsYet')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Predict the Winner */}
            <div className="bg-card-dark p-6 shadow-lg">
              <h2 className="text-center text-2xl font-bold text-white">
                {isBettingPhase ? t('spectate.placeYourBet') : t('spectate.bettingClosed')}
              </h2>
              <p className="mt-2 text-center text-white/60">
                {isBettingPhase 
                  ? t('spectate.mutualParley')
                  : arenaPhase === 'finished' 
                    ? t('spectate.fightConcluded')
                    : t('spectate.fightInProgress')
                }
              </p>

              {/* Winner Selection Buttons */}
              <div className="mt-6 grid grid-cols-1 gap-4">
                <button
                  onClick={() => setSelectedWinner(cock1.id)}
                  disabled={!isBettingPhase}
                  className={`flex w-full items-center justify-between gap-4 p-4 text-base font-bold text-white transition-all duration-300 rounded-lg ${
                    selectedWinner === cock1.id
                      ? 'bg-primary shadow-lg shadow-primary/50'
                      : 'bg-primary/50 hover:bg-primary/70 hover:shadow-lg hover:shadow-primary/30'
                  } ${!isBettingPhase ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <HolographicCard
                      {...getCockHolographicConfig(cock1.rarity)}
                      className={`relative h-12 w-12 flex-shrink-0 overflow-hidden rounded border-2 ${
                        cock1.rarity === 'legendary' ? 'border-rarity-legendary' :
                        cock1.rarity === 'epic' ? 'border-rarity-epic' :
                        cock1.rarity === 'rare' ? 'border-rarity-rare' :
                        cock1.rarity === 'uncommon' ? 'border-rarity-uncommon' :
                        'border-rarity-common'
                      }`}
                    >
                      <img
                        src={getCockImage(cock1.image)}
                        alt={`${cock1.name} portrait`}
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    </HolographicCard>
                    <span className="text-lg">{cock1.name}</span>
                  </div>
                  
                  <span className="text-xl font-bold">({odds.cock1}x)</span>
                </button>

                <button
                  onClick={() => setSelectedWinner(cock2.id)}
                  disabled={!isBettingPhase}
                  className={`flex w-full items-center justify-between gap-4 p-4 text-base font-bold text-white transition-all duration-300 rounded-lg ${
                    selectedWinner === cock2.id
                      ? 'bg-blue-600 shadow-lg shadow-blue-600/50'
                      : 'bg-blue-600/50 hover:bg-blue-600/70 hover:shadow-lg hover:shadow-blue-600/30'
                  } ${!isBettingPhase ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <HolographicCard
                      {...getCockHolographicConfig(cock2.rarity)}
                      className={`relative h-12 w-12 flex-shrink-0 overflow-hidden rounded border-2 ${
                        cock2.rarity === 'legendary' ? 'border-rarity-legendary' :
                        cock2.rarity === 'epic' ? 'border-rarity-epic' :
                        cock2.rarity === 'rare' ? 'border-rarity-rare' :
                        cock2.rarity === 'uncommon' ? 'border-rarity-uncommon' :
                        'border-rarity-common'
                      }`}
                    >
                      <img
                        src={getCockImage(cock2.image)}
                        alt={`${cock2.name} portrait`}
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    </HolographicCard>
                    <span className="text-lg">{cock2.name}</span>
                  </div>
                  
                  <span className="text-xl font-bold">({odds.cock2}x)</span>
                </button>
              </div>

              {/* Bet Amount Input */}
              {isBettingPhase && (
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/80" htmlFor="wager-amount">
                      {t('spectate.betAmount')}
                    </label>
                    <input
                      className="mt-1 block w-full rounded-md border-white/20 bg-background-dark py-2 px-3 text-base text-white focus:border-primary focus:outline-none focus:ring-primary"
                      id="wager-amount"
                      placeholder="Enter bet amount (min 1000 $CFC)"
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      min="1000"
                      step="100"
                    />
                  </div>

                  {/* Balance Display */}
                  <div className="bg-background-dark/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">{t('spectate.yourBalance')}</span>
                      <span className="font-bold text-white">{formatCFC(parseFloat(cfcBalance?.formatted || '0'))} $CFC</span>
                    </div>
                  </div>

                  {/* Place Bet Button */}
                  <button
                    onClick={() => void handlePlaceBet()}
                    disabled={!selectedWinner || !betAmount || escrowLoading}
                    className="w-full rounded-lg bg-primary py-3 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {escrowLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Placing Bet...
                      </span>
                    ) : (
                      t('spectate.placeBet')
                    )}
                  </button>
                  
                  {escrowLoading && (
                    <div className="mt-2 text-xs text-yellow-400 text-center">
                      ⚡ Please sign both transactions (approval + bet)
                    </div>
                  )}
                  
                  {escrowError && (
                    <div className="mt-2 text-xs text-red-400 text-center">
                      {escrowError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cock Stats Modal */}
      {selectedCockForModal && (
        <CockStatsModal 
          cock={selectedCockForModal} 
          onClose={() => setSelectedCockForModal(null)}
          showHealthBars={true}
        />
      )}

      {/* Betting Modal */}
      <BettingModal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </div>
  );
};

export default Spectate;
