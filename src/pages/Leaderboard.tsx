import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HolographicCard from '../components/ui/HolographicCard';
import { useGameStore } from '../store/gameStore';
import { Cock } from '../types';
import CockStatsModal from '../components/CockStatsModal';
import { getCockImage } from '../utils/cockImages';
import { getCockHolographicConfig } from '../utils/cockHoloStyles';
import { formatCFC } from '../utils/formatNumber';

const Leaderboard = () => {
  const { t } = useTranslation();
  const { user, leaderboard, loadLeaderboard } = useGameStore();
  const [selectedCockForModal, setSelectedCockForModal] = useState<Cock | null>(null);
  const [hasRequestedLeaderboard, setHasRequestedLeaderboard] = useState(false);

  // Format owner display name
  const getOwnerDisplay = (cock: Cock) => {
    if (cock.ownerUsername) return cock.ownerUsername;
    const addr = cock.ownerAddress;
    if (!addr || addr.length < 8) {
      return t('leaderboard.unknownOwner');
    }
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  useEffect(() => {
    if (!hasRequestedLeaderboard) {
      setHasRequestedLeaderboard(true);
      void loadLeaderboard();
    }
  }, [hasRequestedLeaderboard, loadLeaderboard]);

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

  const leaderboardData = leaderboard ?? { mostWins: [], highestEarnings: [] };
  const cocksByWins = leaderboardData.mostWins;
  const cocksByEarnings = leaderboardData.highestEarnings;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h2 className="text-4xl font-bold text-white">{t('leaderboard.title')}</h2>
        <p className="mt-2 text-white/60">{t('leaderboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* Most Wins */}
        <div className="bg-card-dark p-6 shadow-lg">
          <h2 className="mb-6 text-center text-2xl font-bold text-white">{t('leaderboard.mostWins')}</h2>
          <div className="space-y-4">
            {cocksByWins.length > 0 ? (
              cocksByWins.map((entry, index) => {
                const cock = entry.cock;
                return (
                  <div key={`wins-${cock.id}`} className={`flex items-center gap-4 bg-background-dark/50 p-3 ${index < 3 ? '' : 'opacity-70'}`}>
                  <span className={`w-6 text-center text-xl font-bold ${index === 0 ? 'text-primary' : index === 1 ? 'text-yellow-500' : index === 2 ? 'text-orange-400' : 'text-white/60'}`}>
                    {index + 1}
                  </span>
                  <HolographicCard
                    {...getCockHolographicConfig(cock.rarity)}
                    className={`relative h-14 w-14 flex-shrink-0 border-2 cursor-pointer overflow-hidden transition-transform hover:scale-110 ${
                      cock.rarity === 'legendary' ? 'border-rarity-legendary' :
                      cock.rarity === 'epic' ? 'border-rarity-epic' :
                      cock.rarity === 'rare' ? 'border-rarity-rare' :
                      cock.rarity === 'uncommon' ? 'border-rarity-uncommon' :
                      'border-rarity-common'
                    }`}
                    onClick={() => setSelectedCockForModal(cock)}
                  >
                    <img
                      src={getCockImage(cock.image)}
                      alt={`${cock.name} portrait`}
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  </HolographicCard>
                  <div className="flex-1">
                    <p className="font-bold text-white">{cock.name}</p>
                    <p className="text-sm text-white/60">{getOwnerDisplay(cock)}</p>
                  </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{entry.wins} {t('leaderboard.wins')}</p>
                      <p className="text-sm text-white/60">{entry.losses} {t('leaderboard.losses')}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/30 bg-black/20 p-8 text-center">
                <span className="text-4xl text-white/30">🏆</span>
                <p className="mt-2 text-sm text-white/60">{t('leaderboard.noWinsYet')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Highest Earned */}
        <div className="bg-card-dark p-6 shadow-lg">
          <h2 className="mb-6 text-center text-2xl font-bold text-white">{t('leaderboard.highestEarned')}</h2>
          <div className="space-y-4">
            {cocksByEarnings.length > 0 ? (
              cocksByEarnings.map((entry, index) => {
                const cock = entry.cock;
                const earned = entry.earningsBnb;
                return (
                  <div key={`earnings-${cock.id}`} className={`flex items-center gap-4 bg-background-dark/50 p-3 ${index < 3 ? '' : 'opacity-70'}`}>
                    <span className={`w-6 text-center text-xl font-bold ${index === 0 ? 'text-primary' : index === 1 ? 'text-yellow-500' : index === 2 ? 'text-orange-400' : 'text-white/60'}`}>
                      {index + 1}
                    </span>
                    <HolographicCard
                      {...getCockHolographicConfig(cock.rarity)}
                      className={`relative h-14 w-14 flex-shrink-0 border-2 cursor-pointer overflow-hidden transition-transform hover:scale-110 ${
                        cock.rarity === 'legendary' ? 'border-rarity-legendary' :
                        cock.rarity === 'epic' ? 'border-rarity-epic' :
                        cock.rarity === 'rare' ? 'border-rarity-rare' :
                        cock.rarity === 'uncommon' ? 'border-rarity-uncommon' :
                        'border-rarity-common'
                      }`}
                      onClick={() => setSelectedCockForModal(cock)}
                    >
                      <img
                        src={getCockImage(cock.image)}
                        alt={`${cock.name} portrait`}
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    </HolographicCard>
                    <div className="flex-1">
                      <p className="font-bold text-white">{cock.name}</p>
                      <p className="text-sm text-white/60">{getOwnerDisplay(cock)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{formatCFC(earned)} $CFC</p>
                      <p className="text-sm text-white/60">{entry.wins} {t('leaderboard.wins')}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/30 bg-black/20 p-8 text-center">
                <span className="text-4xl text-white/30">⭐</span>
                <p className="mt-2 text-sm text-white/60">{t('leaderboard.noCocksYet')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

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

export default Leaderboard;
