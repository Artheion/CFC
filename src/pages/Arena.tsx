import { useState, useRef, useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore';
import { Cock } from '../types';
import CockStatsModal from '../components/CockStatsModal';
import { calculateEnergyCost, getEnergyStats } from '../utils/combatSystem';
import { getCockImage } from '../utils/cockImages';
import { getCockHolographicConfig } from '../utils/cockHoloStyles';
import HolographicCard from '../components/ui/HolographicCard';
import { useWalletContext } from '../contexts/WalletContext';
import { useWalletBalance } from '../hooks/useWalletBalance';
import { useEscrowContract } from '../hooks/useEscrowContract';
import { formatCFC } from '../utils/formatNumber';
import NetworkMismatchNotice from '../components/NetworkMismatchNotice';
import { hasValidAuth, authenticateWithWallet } from '../utils/apiClient';

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

const Arena = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { balance: walletBalance } = useWalletBalance();
  const { 
    cocks: allCocks, 
    user, 
    fightQueue, 
    activeFights,
    createFight, 
    joinFight, 
    removeFightFromQueue 
  } = useGameStore();
  const { address, isCorrectNetwork, provider } = useWalletContext();
  const { createMatch, joinMatch, loading: escrowLoading, error: escrowError, isConfigured: escrowConfigured } = useEscrowContract();

  const cocks = useMemo(() => {
    if (!user) return [];
    return allCocks.filter(cock => cock.ownerAddress === user.walletAddress);
  }, [allCocks, user]);

  const [selectedCockId, setSelectedCockId] = useState<string>('');
  const [wagerAmount, setWagerAmount] = useState<string>('');
  const [joinCockId, setJoinCockId] = useState<string>('');
  const [showJoinModal, setShowJoinModal] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [fightTab, setFightTab] = useState<'active' | 'recent'>('active');
  const [selectedCockForModal, setSelectedCockForModal] = useState<Cock | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showCombatInfo, setShowCombatInfo] = useState(false);

  const {
    containerRef: cockScrollRef,
    isDragging: isCockDrag,
    handlePointerDown: handleCockPointerDown,
    handlePointerMove: handleCockPointerMove,
    handlePointerUp: handleCockPointerUp,
    handlePointerLeave: handleCockPointerLeave,
    handlePointerCancel: handleCockPointerCancel,
  } = useDragScroll(true);

  const {
    containerRef: joinCockScrollRef,
    isDragging: isJoinCockDrag,
    handlePointerDown: handleJoinCockPointerDown,
    handlePointerMove: handleJoinCockPointerMove,
    handlePointerUp: handleJoinCockPointerUp,
    handlePointerLeave: handleJoinCockPointerLeave,
    handlePointerCancel: handleJoinCockPointerCancel,
  } = useDragScroll(true);

  if (address && !isCorrectNetwork) {
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
          <h1 className="mb-4 text-6xl font-bold text-white">Welcome to CFC</h1>
          <p className="mb-8 text-xl text-white/60">Connect your wallet to enter the Cocks Fight Club.</p>
        </div>
      </div>
    );
  }

  // Get W/L record
  const getWLRecord = (cock: Cock) => {
    return `${cock.wins}/${cock.losses}`;
  };

  // Get available cocks (not breeding, not in queue, not in active fight)
  const cocksInQueue = fightQueue.map(f => f.cockId);
  const cocksInActiveFights = activeFights
    .filter(f => f.status !== 'finished')
    .flatMap(f => [f.cock1Id, f.cock2Id]);
  const availableCocks = cocks.filter(c => 
    !c.isBreeding && 
    !cocksInQueue.includes(c.id) &&
    !cocksInActiveFights.includes(c.id)
  );

  // Filter fights based on selected tab
  const activeOngoingFights = activeFights.filter(f => f.status === 'betting' || f.status === 'fighting');
  const recentFinishedFights = activeFights.filter(f => f.status === 'finished');
  const displayedFights = fightTab === 'active' ? activeOngoingFights : recentFinishedFights;

  // Handle queue for fight
  const handleQueueFight = async () => {
    if (!selectedCockId || !wagerAmount) {
      setErrorMessage('Please select a cock and enter a wager amount!');
      setShowErrorModal(true);
      return;
    }

    const wager = parseFloat(wagerAmount);
    if (isNaN(wager) || wager < 1000) {
      setErrorMessage('Please enter a valid wager amount! Minimum is 1000 $CFC.');
      setShowErrorModal(true);
      return;
    }

    if (!user || walletBalance < wager) {
      setErrorMessage(`Insufficient $CFC balance! You need ${formatCFC(wager)} $CFC but only have ${formatCFC(walletBalance)} $CFC.`);
      setShowErrorModal(true);
      return;
    }

    // Check authentication status before proceeding
    if (!hasValidAuth()) {
      console.error('[Arena] No valid authentication token found');
      
      // Try to authenticate
      if (provider && address) {
        try {
          console.log('[Arena] Attempting to authenticate...');
          setErrorMessage('Authenticating with backend...');
          setShowErrorModal(true);
          
          await authenticateWithWallet(provider);
          
          console.log('[Arena] Authentication successful, retrying fight creation');
          setShowErrorModal(false);
          
          // Give a small delay for token to be fully persisted
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Retry the fight creation by calling this function again
          return handleQueueFight();
        } catch (authError) {
          console.error('[Arena] Authentication failed:', authError);
          setErrorMessage(
            'Authentication required to create fights.\n\n' +
            'Please ensure you are connected to the correct network and try again.\n\n' +
            'If the issue persists, try disconnecting and reconnecting your wallet.'
          );
          setShowErrorModal(true);
          return;
        }
      } else {
        setErrorMessage('Please connect your wallet before creating a fight.');
        setShowErrorModal(true);
        return;
      }
    }

    // Check energy - estimate 3 rounds for energy calculation
    const selectedCock = cocks.find(c => c.id === selectedCockId);
    if (selectedCock) {
      const estimatedRounds = 3; // Best of 3, estimate max rounds
      const fightEnergyCost = calculateEnergyCost(estimatedRounds, selectedCock.stats.stamina);
      const { currentEnergy, maxEnergy } = getEnergyStats(selectedCock);

      if (currentEnergy < fightEnergyCost) {
        setErrorMessage(
          `${selectedCock.name} is too exhausted to fight!\n\n` +
          `Energy Required: ${fightEnergyCost}\n` +
          `Current Energy: ${currentEnergy} / ${maxEnergy}\n\n` +
          `Rest your cock or use recovery items!`
        );
        setShowErrorModal(true);
        return;
      }
    }

    // Use escrow contract to create match
    try {
      if (!provider || !address) {
        setErrorMessage('Please connect your wallet first.');
        setShowErrorModal(true);
        return;
      }

      if (!escrowConfigured) {
        setErrorMessage('Escrow contract not configured. Please contact support.');
        setShowErrorModal(true);
        return;
      }

      console.log('[Arena] Creating match on escrow contract with wager:', wager);
      
      // Generate a UUID for the fight (using browser crypto API)
      const fightId = crypto.randomUUID();
      console.log('[Arena] Generated fight ID:', fightId);
      
      console.log('[Arena] Step 1: Calling escrow contract to escrow tokens...');
      console.log('[Arena] This will require 2 signatures:');
      console.log('[Arena]   - Transaction 1: Approve CFC tokens (if needed)');
      console.log('[Arena]   - Transaction 2: Escrow tokens in contract');
      
      // Call escrow contract FIRST to escrow tokens
      const result = await createMatch({
        matchId: fightId,
        wagerAmount: wager.toString(),
      });
      
      console.log('[Arena] createMatch returned:', result);
      
      if (!result.success) {
        const errorMsg = escrowError || 'Failed to escrow tokens on contract';
        console.error('[Arena] Contract error details:', errorMsg);
        setErrorMessage(`${errorMsg}. Fight not created.`);
        setShowErrorModal(true);
        return;
      }
      
      console.log('[Arena] ✅ Tokens escrowed on contract! TxHash:', result.txHash);
      console.log('[Arena] Step 2: Creating fight in database with ID:', fightId);
      
      // Now create fight in database with the contract transaction hash and pre-generated ID
      const createdFight = await createFight(selectedCockId, wager, result.txHash, fightId);
      
      if (!createdFight || createdFight === true) {
        setErrorMessage('Tokens escrowed but failed to create fight in database. Please contact support with txHash: ' + result.txHash);
        setShowErrorModal(true);
        return;
      }
      
      console.log('[Arena] ✅ Fight created in database with ID:', createdFight.id);
      // Success!
      setShowSuccessModal(true);
      setSelectedCockId('');
      setWagerAmount('');
    } catch (error: unknown) {
      console.error('[Arena] CAUGHT ERROR in handleQueueFight:', error);
      console.error('[Arena] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      if (message.includes('user rejected')) {
        setErrorMessage('Payment cancelled. Fight not created.');
      } else if (message.includes('Contract call failed') || message.includes('not found')) {
        // Contract verification errors - show full message with formatting
        setErrorMessage(message);
      } else {
        setErrorMessage(`Payment failed: ${message}. Check browser console for details.`);
      }
      setShowErrorModal(true);
    }
  };

  // Handle join fight
  const handleJoinFight = async (fightQueueId: string) => {
    if (!joinCockId) {
      setErrorMessage('Please select a cock to fight with!');
      setShowErrorModal(true);
      return;
    }

    // Check authentication status before proceeding
    if (!hasValidAuth()) {
      console.error('[Arena] No valid authentication token found for join fight');
      
      // Try to authenticate
      if (provider && address) {
        try {
          console.log('[Arena] Attempting to authenticate before joining fight...');
          setErrorMessage('Authenticating with backend...');
          setShowErrorModal(true);
          
          await authenticateWithWallet(provider);
          
          console.log('[Arena] Authentication successful, retrying join fight');
          setShowErrorModal(false);
          
          // Give a small delay for token to be fully persisted
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Retry the join fight by calling this function again
          return handleJoinFight(fightQueueId);
        } catch (authError) {
          console.error('[Arena] Authentication failed:', authError);
          setErrorMessage(
            'Authentication required to join fights.\n\n' +
            'Please ensure you are connected to the correct network and try again.\n\n' +
            'If the issue persists, try disconnecting and reconnecting your wallet.'
          );
          setShowErrorModal(true);
          return;
        }
      } else {
        setErrorMessage('Please connect your wallet before joining a fight.');
        setShowErrorModal(true);
        return;
      }
    }

    const fight = fightQueue.find(f => f.id === fightQueueId);
    const selectedCock = cocks.find(c => c.id === joinCockId);
    
    // Check energy
    if (selectedCock) {
      const estimatedRounds = 3;
      const fightEnergyCost = calculateEnergyCost(estimatedRounds, selectedCock.stats.stamina);
      const { currentEnergy, maxEnergy } = getEnergyStats(selectedCock);

      if (currentEnergy < fightEnergyCost) {
        setErrorMessage(
          `${selectedCock.name} is too exhausted to fight!\n\n` +
          `Energy Required: ${fightEnergyCost}\n` +
          `Current Energy: ${currentEnergy} / ${maxEnergy}\n\n` +
          `Rest your cock or use recovery items!`
        );
        setShowErrorModal(true);
        return;
      }
    }

    // Check balance
    if (fight && user && walletBalance < fight.wager) {
      setErrorMessage(`Insufficient $CFC balance! You need ${formatCFC(fight.wager)} $CFC but only have ${formatCFC(walletBalance)} $CFC.`);
      setShowErrorModal(true);
      return;
    }

    // Sign $CFC token payment
    try {
      if (!provider || !address || !fight) {
        setErrorMessage('Please connect your wallet first.');
        setShowErrorModal(true);
        return;
      }

      if (!escrowConfigured) {
        setErrorMessage('Escrow contract not configured. Please contact support.');
        setShowErrorModal(true);
        return;
      }

      console.log('[Arena] Joining match on escrow contract with wager:', fight.wager);
      
      // Call escrow contract to join match and escrow tokens
      const result = await joinMatch({
        matchId: fightQueueId,
        wagerAmount: fight.wager.toString(),
      });
      
      if (!result.success) {
        setErrorMessage('Failed to escrow tokens on contract. Fight not joined.');
        setShowErrorModal(true);
        return;
      }
      
      console.log('[Arena] Match joined on contract:', result.txHash);
      
      // Join fight in backend with contract transaction hash
      const newFightId = await joinFight(fightQueueId, joinCockId, result.txHash);
      if (newFightId) {
        // Success!
        setShowJoinModal(null);
        setJoinCockId('');
        navigate(`/spectate/${newFightId}`);
      } else {
        setErrorMessage('Failed to join fight. Your cock may be breeding, already in queue, currently fighting, or the fight may have been taken.');
        setShowErrorModal(true);
      }
    } catch (error: unknown) {
      console.error('[Arena] Join fight error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Check for user rejection
      if (errorMsg.includes('user rejected')) {
        setErrorMessage('Payment cancelled. Fight not joined.');
        setShowErrorModal(true);
        return;
      }
      
      // Parse backend error messages
      if (errorMsg.includes('Cannot fight against your own cock')) {
        setErrorMessage('You cannot fight against your own cock! This fight was created by you. Please use a different account or wait for another player to create a fight.');
      } else if (errorMsg.includes('already committed to another fight')) {
        setErrorMessage('This cock is already in another fight. Please select a different cock.');
      } else if (errorMsg.includes('Fight is not open for joining')) {
        setErrorMessage('This fight is no longer available. It may have already been joined by another player.');
      } else if (errorMsg.includes('Cock not found')) {
        setErrorMessage('Selected cock not found. Please refresh and try again.');
      } else {
        setErrorMessage(`Failed to join fight: ${errorMsg}`);
      }
      setShowErrorModal(true);
    }
  };

  // Handle cancel fight
  const handleCancelFight = (fightQueueId: string) => {
    setShowCancelModal(fightQueueId);
  };

  // Confirm cancel fight
  const confirmCancelFight = () => {
    if (showCancelModal) {
      void removeFightFromQueue(showCancelModal);
      setShowCancelModal(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <div className="flex items-center justify-center gap-3">
          {/* Invisible spacer to balance the button on the right */}
          <div className="h-6 w-6 opacity-0 pointer-events-none">!</div>
          <h2 className="text-4xl font-bold text-white">{t('arena.title')}</h2>
          <button
            className="group relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/30 text-xs text-white/60 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
          >
            !
            {showInfo && (
              <div className="absolute left-1/2 top-8 z-50 w-96 -translate-x-1/2 rounded-lg border border-white/20 bg-background-dark p-4 text-left text-sm shadow-xl">
                <h4 className="mb-3 font-bold text-white">{t('arena.howItWorksTitle')}</h4>
                <p className="mb-2 text-white/80">
                  {t('arena.howItWorksText1')}
                </p>
                <p className="mb-3 text-white/80">
                  {t('arena.howItWorksText2')}
                </p>
                <div className="overflow-hidden rounded border border-white/20">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="px-3 py-2 text-left font-semibold text-white">{t('arena.rarityTableHeader')}</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">{t('arena.bonusPercentHeader')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-white/10">
                        <td className="px-3 py-2 text-rarity-common">Common</td>
                        <td className="px-3 py-2 text-right text-white/80">2%</td>
                      </tr>
                      <tr className="border-t border-white/10">
                        <td className="px-3 py-2 text-rarity-uncommon">Uncommon</td>
                        <td className="px-3 py-2 text-right text-white/80">3%</td>
                      </tr>
                      <tr className="border-t border-white/10">
                        <td className="px-3 py-2 text-rarity-rare">Rare</td>
                        <td className="px-3 py-2 text-right text-white/80">4%</td>
                      </tr>
                      <tr className="border-t border-white/10">
                        <td className="px-3 py-2 text-rarity-epic">Epic</td>
                        <td className="px-3 py-2 text-right text-white/80">5%</td>
                      </tr>
                      <tr className="border-t border-white/10">
                        <td className="px-3 py-2 text-rarity-legendary">Legendary</td>
                        <td className="px-3 py-2 text-right text-white/80">6%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </button>
        </div>
        <p className="mt-2 text-white/60">{t('arena.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="space-y-8">
            {/* Fights Section with Tabs */}
            {activeFights.length > 0 && (
              <div>
                {/* Tab Buttons */}
                <div className="mb-4 flex items-center gap-4">
                  <button
                    onClick={() => setFightTab('active')}
                    className={`px-6 py-2 font-bold transition-all ${
                      fightTab === 'active'
                        ? 'bg-primary text-white'
                        : 'bg-card-dark text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {t('arena.activeFights')}
                  </button>
                  <button
                    onClick={() => setFightTab('recent')}
                    className={`px-6 py-2 font-bold transition-all ${
                      fightTab === 'recent'
                        ? 'bg-primary text-white'
                        : 'bg-card-dark text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {t('arena.recentFights')}
                  </button>
                </div>

                {/* Fights Display */}
                {displayedFights.length > 0 ? (
                  <div className="bg-card-dark shadow-lg divide-y divide-white/10">
                    {displayedFights.slice(0, fightTab === 'recent' ? 20 : 5).map((fight) => {
                    const cock1 = fight.cock1 ?? cocks.find(c => c.id === fight.cock1Id);
                    const cock2 = fight.cock2 ?? cocks.find(c => c.id === fight.cock2Id);
                    
                    if (!cock1 || !cock2) return null;

                    const cock1Wins = fight.rounds.filter(r => r.winnerId === cock1.id).length;
                    const cock2Wins = fight.rounds.filter(r => r.winnerId === cock2.id).length;
                    
                    // Calculate total wager volume (main wager + spectator bets)
                    const spectatorBetsTotal = fight.spectatorBets.reduce((sum, bet) => sum + Number(bet.amount || 0), 0);
                    const totalWagerVolume = (Number(fight.wager || 0) * 2) + spectatorBetsTotal;
                    
                    // Determine fight status text
                    let statusText = '';
                    let statusColor = 'text-white/60';
                    if (fight.status === 'betting') {
                      statusText = 'Betting Phase';
                      statusColor = 'text-yellow-500';
                    } else if (fight.status === 'fighting') {
                      statusText = `Round ${fight.currentRound} - Fighting!`;
                      statusColor = 'text-primary animate-pulse';
                    } else {
                      statusText = 'Finished';
                      statusColor = 'text-white/60';
                    }

                    return (
                      <div key={fight.id} className="p-6 transition-colors hover:bg-white/5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex w-2/5 flex-col items-center gap-3">
                            <HolographicCard
                              {...getCockHolographicConfig(cock1.rarity)}
                              className={`relative h-24 w-24 flex-shrink-0 overflow-hidden border-2 cursor-pointer transition-transform hover:scale-105 ${
                                cock1.rarity === 'legendary' ? 'border-rarity-legendary' :
                                cock1.rarity === 'epic' ? 'border-rarity-epic' :
                                cock1.rarity === 'rare' ? 'border-rarity-rare' :
                                'border-rarity-common'
                              }`}
                              onClick={() => setSelectedCockForModal(cock1)}
                            >
                              <img
                                src={getCockImage(cock1.image)}
                                alt={`${cock1.name} portrait`}
                                className="h-full w-full object-cover"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                            </HolographicCard>
                            <p className="font-bold text-white">{cock1.name}</p>
                            <p className={`text-sm font-bold ${
                              fight.status === 'finished' && fight.winnerId === cock1.id 
                                ? 'text-primary' 
                                : 'text-white/60'
                            }`}>
                              Score: {cock1Wins}
                            </p>
                          </div>

                          <div className="flex flex-col items-center gap-2 text-center">
                            <span className="text-lg font-bold text-primary">VS</span>
                            
                            {/* Status */}
                            <p className={`text-xs font-semibold ${statusColor}`}>
                              {statusText}
                            </p>
                            
                            {/* Total Wager Volume */}
                            <div className="text-center">
                              <p className="text-xs text-white/60">{t('arena.totalVolume')}</p>
                              <p className="font-bold text-primary">{formatCFC(isNaN(totalWagerVolume) ? 0 : totalWagerVolume)} $CFC</p>
                            </div>
                            
                            {/* Score Display */}
                            {fight.rounds.length > 0 && (
                              <div className="text-center">
                                <p className="text-xs text-white/60">{t('arena.bestOf3')}</p>
                                <p className="text-lg font-bold text-white">{cock1Wins} - {cock2Wins}</p>
                              </div>
                            )}
                            
                            <button 
                              onClick={() => navigate(`/spectate/${fight.id}`)}
                              className="mt-2 h-10 bg-primary/80 px-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
                            >
                              {fight.status === 'finished' ? t('arena.viewResult') : t('arena.watchLive')}
                            </button>
                          </div>

                          <div className="flex w-2/5 flex-col items-center gap-3">
                            <HolographicCard
                              {...getCockHolographicConfig(cock2.rarity)}
                              className={`relative h-24 w-24 flex-shrink-0 overflow-hidden border-2 cursor-pointer transition-transform hover:scale-105 ${
                                cock2.rarity === 'legendary' ? 'border-rarity-legendary' :
                                cock2.rarity === 'epic' ? 'border-rarity-epic' :
                                cock2.rarity === 'rare' ? 'border-rarity-rare' :
                                'border-rarity-common'
                              }`}
                              onClick={() => setSelectedCockForModal(cock2)}
                            >
                              <img
                                src={getCockImage(cock2.image)}
                                alt={`${cock2.name} portrait`}
                                className="h-full w-full object-cover"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                            </HolographicCard>
                            <p className="font-bold text-white">{cock2.name}</p>
                            <p className={`text-sm font-bold ${
                              fight.status === 'finished' && fight.winnerId === cock2.id 
                                ? 'text-primary' 
                                : 'text-white/60'
                            }`}>
                              Score: {cock2Wins}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                ) : (
                  <div className="bg-card-dark shadow-lg p-8 text-center">
                    <p className="text-white/60">
                      {fightTab === 'active' 
                        ? 'No active fights at the moment. Queue up for a fight or wait for others to join!'
                        : 'No recent fights yet. Complete some fights to see them here!'
                      }
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Your Queued Fights */}
            {fightQueue.filter(fight => fight.ownerAddress === user?.walletAddress).length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Your Queued Fights</h2>
                    <p className="text-sm text-white/60 mt-1">Waiting for opponents to join</p>
                  </div>
                </div>

                <div className="mt-4 bg-card-dark shadow-lg">
                  <div className="divide-y divide-white/10">
                    <div className="grid grid-cols-5 items-center gap-4 p-4 text-sm font-semibold text-white/60">
                      <div className="col-span-2">Cock</div>
                      <div>W/L</div>
                      <div>Wager</div>
                      <div></div>
                    </div>

                    {fightQueue.filter(fight => fight.ownerAddress === user?.walletAddress).map((fight) => {
                      const cock = fight.cock ?? cocks.find(c => c.id === fight.cockId);
                      if (!cock) return null;

                      const wlRecord = getWLRecord(cock);
                      const rarityColor = cock.rarity === 'legendary' ? 'border-rarity-legendary' : 
                                          cock.rarity === 'epic' ? 'border-rarity-epic' : 
                                          cock.rarity === 'rare' ? 'border-rarity-rare' :
                                          'border-rarity-common';
                      const rarityText = cock.rarity === 'legendary' ? 'text-rarity-legendary' : 
                                         cock.rarity === 'epic' ? 'text-rarity-epic' : 
                                         cock.rarity === 'rare' ? 'text-rarity-rare' :
                                         'text-rarity-common';

                      return (
                        <div key={fight.id} className="grid grid-cols-5 items-center gap-4 p-4 transition-colors bg-primary/5 border-l-4 border-primary">
                          <div className="col-span-2 flex items-center gap-4">
                            <HolographicCard
                              {...getCockHolographicConfig(cock.rarity)}
                              className={`relative h-14 w-14 flex-shrink-0 overflow-hidden border-2 cursor-pointer transition-transform hover:scale-110 ${rarityColor}`}
                              onClick={() => setSelectedCockForModal(cock)}
                            >
                              <img
                                src={getCockImage(cock.image)}
                                alt={`${cock.name} portrait`}
                                className="h-full w-full object-cover"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            </HolographicCard>
                            <div>
                              <p className="font-bold text-white">{cock.name}</p>
                              <p className={`text-sm capitalize ${rarityText}`}>{cock.rarity}</p>
                            </div>
                          </div>
                          <div className="font-semibold text-white">{wlRecord}</div>
                          <div className="font-bold text-primary">{formatCFC(isNaN(fight.wager) ? 0 : Number(fight.wager))} $CFC</div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleCancelFight(fight.id)}
                              className="h-10 bg-red-500/80 px-4 text-sm font-bold text-white transition-all hover:bg-red-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Available Fights */}
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">{t('arena.availableFights')}</h2>
              </div>

              <div className="mt-4 bg-card-dark shadow-lg">
                {fightQueue.length > 0 ? (
                  <div className="divide-y divide-white/10">
                    <div className="grid grid-cols-5 items-center gap-4 p-4 text-sm font-semibold text-white/60">
                      <div className="col-span-2">Cock</div>
                      <div>W/L</div>
                      <div>Wager</div>
                      <div></div>
                    </div>

                    {fightQueue.filter(fight => {
                      // Filter out fights created by the current user
                      return fight.ownerAddress !== user?.walletAddress;
                    }).map((fight) => {
                      const cock = fight.cock ?? cocks.find(c => c.id === fight.cockId);
                      if (!cock) return null;

                      const wlRecord = getWLRecord(cock);
                      const isOwnFight = fight.ownerAddress === user?.walletAddress;
                      const rarityColor = cock.rarity === 'legendary' ? 'border-rarity-legendary' : 
                                          cock.rarity === 'epic' ? 'border-rarity-epic' : 
                                          cock.rarity === 'rare' ? 'border-rarity-rare' :
                                          'border-rarity-common';
                      const rarityText = cock.rarity === 'legendary' ? 'text-rarity-legendary' : 
                                         cock.rarity === 'epic' ? 'text-rarity-epic' : 
                                         cock.rarity === 'rare' ? 'text-rarity-rare' :
                                         'text-rarity-common';

                      return (
                        <div key={fight.id} className="grid grid-cols-5 items-center gap-4 p-4 transition-colors hover:bg-white/5">
                          <div className="col-span-2 flex items-center gap-4">
                            <HolographicCard
                              {...getCockHolographicConfig(cock.rarity)}
                              className={`relative h-14 w-14 flex-shrink-0 overflow-hidden border-2 cursor-pointer transition-transform hover:scale-110 ${rarityColor}`}
                              onClick={() => setSelectedCockForModal(cock)}
                            >
                              <img
                                src={getCockImage(cock.image)}
                                alt={`${cock.name} portrait`}
                                className="h-full w-full object-cover"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            </HolographicCard>
                            <div>
                              <p className="font-bold text-white">{cock.name}</p>
                              <p className={`text-sm capitalize ${rarityText}`}>{cock.rarity}</p>
                            </div>
                          </div>
                          <div className="font-semibold text-white">{wlRecord}</div>
                          <div className="font-bold text-primary">{formatCFC(isNaN(fight.wager) ? 0 : Number(fight.wager))} $CFC</div>
                          <div className="flex gap-2">
                            {isOwnFight && (
                              <button 
                                onClick={() => handleCancelFight(fight.id)}
                                className="h-10 bg-white/10 px-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
                              >
                                Cancel
                              </button>
                            )}
                            {!isOwnFight && (
                              <button 
                                onClick={() => setShowJoinModal(fight.id)}
                                className="h-10 bg-primary px-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
                              >
                                Fight
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Show message if all fights are filtered out */}
                    {fightQueue.filter(fight => fight.ownerAddress !== user?.walletAddress).length === 0 && (
                      <div className="p-8 text-center text-white/60">
                        <p>No opponents available. Wait for other players to queue up!</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <span className="text-6xl text-white/20">⚔️</span>
                    <p className="mt-4 text-lg font-bold text-white">{t('arena.noFightsAvailable')}</p>
                    <p className="mt-2 text-sm text-white/60">{t('arena.queueToStart')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Queue Sidebar */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 bg-card-dark p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-center gap-2">
              <h2 className="text-2xl font-bold text-white">{t('arena.queueForFight')}</h2>
              <button
                className="group relative flex h-5 w-5 items-center justify-center rounded-full border border-white/30 text-xs text-white/60 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                onMouseEnter={() => setShowCombatInfo(true)}
                onMouseLeave={() => setShowCombatInfo(false)}
              >
                !
                {showCombatInfo && (
                  <div className="absolute right-0 top-7 z-50 w-72 rounded-lg border border-white/20 bg-background-dark p-4 text-left text-sm shadow-xl">
                    <h4 className="mb-3 font-bold text-white">{t('arena.combatCostsTitle')}</h4>
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-white">{t('arena.combatCostsLabel')}</h5>
                      <ul className="space-y-1 text-xs text-white/70">
                        <li>• <span className="text-white/90">{t('arena.healthLossLabel')}</span> {t('arena.healthLossValue')}</li>
                        <li>• <span className="text-white/90">{t('arena.energyCostLabel')}</span> {t('arena.energyCostValue')}</li>
                      </ul>
                      <h5 className="mt-3 text-xs font-bold text-white">{t('arena.naturalRecoveryLabel')}</h5>
                      <ul className="space-y-1 text-xs text-white/70">
                        <li>• <span className="text-white/90">{t('arena.healthRecoveryLabel')}</span> {t('arena.healthRecoveryValue')}</li>
                        <li>• <span className="text-white/90">{t('arena.energyRecoveryLabel')}</span> {t('arena.energyRecoveryValue')}</li>
                        <li className="mt-2 italic text-primary">{t('arena.recoveryTipText')}</li>
                      </ul>
                      <div className="rounded bg-yellow-500/10 border border-yellow-500/30 p-2 mt-3">
                        <p className="text-xs text-yellow-200">
                          <span className="font-bold">Note:</span> All cocks start fights at 100% health regardless of their current health status.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </button>
            </div>
            <p className="mb-6 text-center text-white/60">{t('arena.selectAndWager')}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1 text-center">{t('arena.selectYourFighter')}</label>
                {availableCocks.length > 2 && (
                  <p className="text-xs text-white/40 mb-3 text-center">{t('arena.dragToScroll')}</p>
                )}
                <div 
                  ref={cockScrollRef}
                  className={`flex gap-6 scrollbar-hide ${isCockDrag ? 'cursor-grabbing' : 'cursor-grab'}`}
                  onPointerDown={handleCockPointerDown}
                  onPointerMove={handleCockPointerMove}
                  onPointerUp={handleCockPointerUp}
                  onPointerLeave={handleCockPointerLeave}
                  onPointerCancel={handleCockPointerCancel}
                  style={{
                    touchAction: 'pan-y',
                    userSelect: isCockDrag ? 'none' : 'auto',
                    overflowX: 'auto',
                    padding: '1.5rem',
                    margin: '-1.5rem',
                  }}
                >
                  {availableCocks.length > 0 ? (
                    availableCocks.map((cock) => {
                      const isSelected = selectedCockId === cock.id;
                      const cockImage = getCockImage(cock.image);
                      const estimatedRounds = 3;
                      const fightEnergyCost = calculateEnergyCost(estimatedRounds, cock.stats.stamina);
                      const { currentEnergy, maxEnergy } = getEnergyStats(cock);
                      const hasSufficientEnergy = currentEnergy >= fightEnergyCost;
                      
                      const rarityBorder = cock.rarity === 'legendary' ? 'border-rarity-legendary' :
                                           cock.rarity === 'epic' ? 'border-rarity-epic' :
                                           cock.rarity === 'rare' ? 'border-rarity-rare' :
                                           cock.rarity === 'uncommon' ? 'border-rarity-uncommon' :
                                           'border-rarity-common';
                      
                      const rarityGlow = cock.rarity === 'legendary' ? 'shadow-[0_0_24px_4px_rgba(249,115,22,0.6)]' : 
                                         cock.rarity === 'epic' ? 'shadow-[0_0_20px_4px_rgba(192,132,252,0.5)]' : 
                                         cock.rarity === 'rare' ? 'shadow-[0_0_18px_3px_rgba(59,130,246,0.5)]' :
                                         cock.rarity === 'uncommon' ? 'shadow-[0_0_16px_3px_rgba(34,197,94,0.4)]' :
                                         'shadow-[0_0_14px_2px_rgba(148,163,184,0.3)]';

                      const rarityText = cock.rarity === 'legendary' ? 'text-rarity-legendary' : 
                                         cock.rarity === 'epic' ? 'text-rarity-epic' : 
                                         cock.rarity === 'rare' ? 'text-rarity-rare' : 
                                         cock.rarity === 'uncommon' ? 'text-rarity-uncommon' :
                                         'text-rarity-common';
                      
                      return (
                        <div
                          key={cock.id}
                          onClick={(e) => {
                            if (!isCockDrag) {
                              setSelectedCockId(cock.id);
                            }
                          }}
                          style={{ overflow: 'visible' }}
                          className={`relative w-[148px] flex-shrink-0 ${!hasSufficientEnergy ? 'opacity-50' : 'cursor-pointer'} bg-card-dark transition-all duration-200 ${isSelected ? rarityGlow : ''}`}
                        >
                          <HolographicCard
                            {...getCockHolographicConfig(cock.rarity)}
                            className={`relative border-2 ${rarityBorder}`}
                            style={{ overflow: 'visible' }}
                          >
                            <div className="relative aspect-square w-full overflow-hidden">
                              <img
                                src={cockImage}
                                alt={cock.name}
                                className="h-full w-full object-cover"
                                draggable={false}
                                onPointerDown={(e) => e.preventDefault()}
                              />
                              <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                            </div>
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2">
                              <p className="truncate text-sm font-bold text-white">{cock.name}</p>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-white/70">{cock.wins}/{cock.losses}</span>
                                <span className={`font-semibold capitalize ${rarityText}`}>{cock.rarity}</span>
                              </div>
                            </div>
                          </HolographicCard>
                        </div>
                      );
                    })
                  ) : (
                    <div className="w-full p-6 text-center border-2 border-dashed border-white/20 bg-white/5">
                      <p className="text-sm text-white/60">{t('arena.noAvailableFighters')}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80" htmlFor="wager-amount">{t('arena.setWagerLabel')}</label>
                <input 
                  className="mt-1 block w-full border-white/20 bg-background-dark py-2 px-3 text-base text-white focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                  id="wager-amount"
                  placeholder={t('arena.wagerPlaceholder')}
                  type="number"
                  value={wagerAmount}
                  onChange={(e) => setWagerAmount(e.target.value)}
                  min="1000"
                  step="100"
                />
              </div>

              <div className="bg-background-dark/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">{t('arena.yourBalance')}</span>
                  <span className="font-bold text-white">
                    {formatCFC(walletBalance)} $CFC
                  </span>
                </div>
              </div>

              {/* Energy Display */}
              {selectedCockId && (() => {
                const selectedCock = cocks.find(c => c.id === selectedCockId);
                if (!selectedCock) return null;
                
                const estimatedRounds = 3;
                const fightEnergyCost = calculateEnergyCost(estimatedRounds, selectedCock.stats.stamina);
                const { currentEnergy, maxEnergy, energyPercent } = getEnergyStats(selectedCock);
                const hasSufficientEnergy = currentEnergy >= fightEnergyCost;
                
                return (
                  <div className={`border-2 p-4 ${hasSufficientEnergy ? 'border-blue-500/30 bg-blue-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{t('arena.energyLabel')}</span>
                      <span className={`text-sm font-bold ${hasSufficientEnergy ? 'text-blue-400' : 'text-red-400'}`}>
                        {currentEnergy} / {maxEnergy}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-background-dark overflow-hidden mb-2">
                      <div 
                        className={`h-full transition-all ${hasSufficientEnergy ? 'bg-blue-500' : 'bg-red-500'}`}
                        style={{ width: `${energyPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">{t('arena.fightCostLabel')}</span>
                      <span className={`font-bold ${hasSufficientEnergy ? 'text-white' : 'text-red-400'}`}>
                        ~{fightEnergyCost} energy
                      </span>
                    </div>
                    {!hasSufficientEnergy && (
                      <p className="mt-2 text-xs text-red-400 font-medium">
                        {t('arena.insufficientEnergyWarning')}
                      </p>
                    )}
                  </div>
                );
              })()}

              <button 
                onClick={handleQueueFight}
                disabled={!selectedCockId || !wagerAmount || escrowLoading}
                className="flex w-full items-center justify-center gap-2 bg-primary py-3 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {escrowLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Escrowing Tokens...
                  </span>
                ) : (
                  t('arena.queueFightButton')
                )}
              </button>
              
              {escrowLoading && (
                <div className="mt-2 text-xs text-yellow-400 text-center">
                  <div className="font-bold mb-2">⚡ Please sign BOTH wallet transactions:</div>
                  <div className="flex items-center justify-center gap-4">
                    <div>1️⃣ Approve {formatCFC(parseFloat(wagerAmount) || 0)} $CFC tokens</div>
                    <div>2️⃣ Escrow tokens in contract</div>
                  </div>
                </div>
              )}
              
              {escrowError && (
                <div className="mt-2 text-xs text-red-400 text-center">
                  {escrowError}
                </div>
              )}

              <div className="mt-6 bg-primary/10 border border-primary/30 p-4">
                <h3 className="text-center text-sm font-bold text-white mb-3 tracking-wide">{t('arena.fightRules')}</h3>
                <div className="flex items-center justify-around text-xs text-white/80">
                  <div className="text-center">
                    <p className="font-semibold text-white tracking-wide">{t('arena.bestOf3')}</p>
                    <p className="text-white/60 tracking-wider">{t('arena.rounds')}</p>
                  </div>
                  <div className="h-8 w-px bg-white/20"></div>
                  <div className="text-center">
                    <p className="font-semibold text-white tracking-wide">{t('arena.winnerTakesAll')}</p>
                    <p className="text-white/60 tracking-wider">{t('arena.takesAll')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Join Fight Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-card-dark p-6 shadow-2xl animate-scaleIn">
            <h3 className="mb-2 text-2xl font-bold text-white text-center">{t('arena.selectFighterTitle')}</h3>
            {availableCocks.length > 2 && (
              <p className="text-xs text-white/40 mb-4 text-center">{t('arena.dragToScroll')}</p>
            )}
            
            <div className="mb-6">
              <div 
                ref={joinCockScrollRef}
                className={`flex gap-6 scrollbar-hide ${isJoinCockDrag ? 'cursor-grabbing' : 'cursor-grab'}`}
                onPointerDown={handleJoinCockPointerDown}
                onPointerMove={handleJoinCockPointerMove}
                onPointerUp={handleJoinCockPointerUp}
                onPointerLeave={handleJoinCockPointerLeave}
                onPointerCancel={handleJoinCockPointerCancel}
                style={{
                  touchAction: 'pan-y',
                  userSelect: isJoinCockDrag ? 'none' : 'auto',
                  overflowX: 'auto',
                  padding: '1.5rem',
                  margin: '-1.5rem',
                }}
              >
                {availableCocks.length > 0 ? (
                  availableCocks.map((cock) => {
                    const isSelected = joinCockId === cock.id;
                    const cockImage = getCockImage(cock.image);
                    const estimatedRounds = 3;
                    const fightEnergyCost = calculateEnergyCost(estimatedRounds, cock.stats.stamina);
                    const { currentEnergy, maxEnergy } = getEnergyStats(cock);
                    const hasSufficientEnergy = currentEnergy >= fightEnergyCost;
                    
                    const rarityBorder = cock.rarity === 'legendary' ? 'border-rarity-legendary' :
                                         cock.rarity === 'epic' ? 'border-rarity-epic' :
                                         cock.rarity === 'rare' ? 'border-rarity-rare' :
                                         cock.rarity === 'uncommon' ? 'border-rarity-uncommon' :
                                         'border-rarity-common';
                    
                    const rarityGlow = cock.rarity === 'legendary' ? 'shadow-[0_0_24px_4px_rgba(249,115,22,0.6)]' : 
                                       cock.rarity === 'epic' ? 'shadow-[0_0_20px_4px_rgba(192,132,252,0.5)]' : 
                                       cock.rarity === 'rare' ? 'shadow-[0_0_18px_3px_rgba(59,130,246,0.5)]' :
                                       cock.rarity === 'uncommon' ? 'shadow-[0_0_16px_3px_rgba(34,197,94,0.4)]' :
                                       'shadow-[0_0_14px_2px_rgba(148,163,184,0.3)]';

                    const rarityText = cock.rarity === 'legendary' ? 'text-rarity-legendary' : 
                                       cock.rarity === 'epic' ? 'text-rarity-epic' : 
                                       cock.rarity === 'rare' ? 'text-rarity-rare' : 
                                       cock.rarity === 'uncommon' ? 'text-rarity-uncommon' :
                                       'text-rarity-common';
                    
                    return (
                      <div
                        key={cock.id}
                        onClick={(e) => {
                          if (!isJoinCockDrag) {
                            setJoinCockId(cock.id);
                          }
                        }}
                        style={{ overflow: 'visible' }}
                        className={`relative w-[148px] flex-shrink-0 ${!hasSufficientEnergy ? 'opacity-50' : 'cursor-pointer'} bg-card-dark transition-all duration-200 ${isSelected ? rarityGlow : ''}`}
                      >
                        <HolographicCard
                          {...getCockHolographicConfig(cock.rarity)}
                          className={`relative border-2 ${rarityBorder}`}
                          style={{ overflow: 'visible' }}
                        >
                          <div className="relative aspect-square w-full overflow-hidden">
                            <img
                              src={cockImage}
                              alt={cock.name}
                              className="h-full w-full object-cover"
                              draggable={false}
                              onPointerDown={(e) => e.preventDefault()}
                            />
                            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                          </div>
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2">
                            <p className="truncate text-sm font-bold text-white">{cock.name}</p>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-white/70">{cock.wins}/{cock.losses}</span>
                              <span className={`font-semibold capitalize ${rarityText}`}>{cock.rarity}</span>
                            </div>
                          </div>
                        </HolographicCard>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full p-6 text-center border-2 border-dashed border-white/20 bg-white/5">
                    <p className="text-sm text-white/60">No available fighters</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowJoinModal(null);
                  setJoinCockId('');
                }}
                className="flex-1 bg-white/10 py-3 font-bold text-white hover:bg-white/20"
              >
                {t('arena.cancelButton')}
              </button>
              <button 
                onClick={() => void handleJoinFight(showJoinModal)}
                disabled={!joinCockId || escrowLoading}
                className="flex-1 bg-primary py-3 font-bold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {escrowLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Escrowing Tokens...
                  </span>
                ) : (
                  t('arena.fightButton')
                )}
              </button>
            </div>
            
            {escrowLoading && (
              <div className="mt-4 text-xs text-yellow-400 text-center">
                <div className="font-bold mb-2">⚡ Please sign BOTH wallet transactions:</div>
                <div className="flex items-center justify-center gap-4">
                  <div>1️⃣ Approve {showJoinModal && fightQueue.find(f => f.id === showJoinModal) ? formatCFC(fightQueue.find(f => f.id === showJoinModal)!.wager) : '...'} $CFC tokens</div>
                  <div>2️⃣ Escrow tokens in contract</div>
                </div>
              </div>
            )}
            
            {escrowError && (
              <div className="mt-4 text-xs text-red-400 text-center">
                {escrowError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-card-dark p-6 shadow-2xl border-2 border-primary animate-scaleIn">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                <span className="text-4xl">✓</span>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-white">{t('arena.fightCreatedTitle')}</h3>
              <p className="mb-6 text-white/60">
                {t('arena.fightCreatedMessage')}
              </p>
              <button 
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-primary py-3 font-bold text-white hover:opacity-90"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-card-dark p-6 shadow-2xl border-2 border-red-500 animate-scaleIn">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                <span className="text-4xl">⚠</span>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-white">{t('arena.oopsTitle')}</h3>
              <div className="mb-6 text-left text-sm text-white/80 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {errorMessage}
              </div>
              <button 
                onClick={() => setShowErrorModal(false)}
                className="w-full bg-red-500 py-3 font-bold text-white hover:opacity-90"
              >
                {t('arena.closeButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-card-dark p-6 shadow-2xl animate-scaleIn">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20">
                <span className="text-4xl">⚠️</span>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-white">{t('arena.cancelFightTitle')}</h3>
              <p className="mb-6 text-white/60">
                {t('arena.cancelFightMessage')}
              </p>
              <div className="flex w-full gap-3">
                <button 
                  onClick={() => setShowCancelModal(null)}
                  className="flex-1 bg-white/10 py-3 font-bold text-white hover:bg-white/20"
                >
                  {t('arena.noKeepIt')}
                </button>
                <button 
                  onClick={confirmCancelFight}
                  className="flex-1 bg-primary py-3 font-bold text-white hover:opacity-90"
                >
                  {t('arena.yesCancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cock Stats Modal */}
      {selectedCockForModal && (
        <CockStatsModal 
          cock={selectedCockForModal} 
          onClose={() => setSelectedCockForModal(null)}
          showHealthBars={false}
        />
      )}
    </div>
  );
};

export default Arena;
