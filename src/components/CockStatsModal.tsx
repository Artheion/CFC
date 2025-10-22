import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cock } from '../types';
import { getEnergyStats } from '../utils/combatSystem';
import { getCockImage } from '../utils/cockImages';
import { getCockHolographicConfig } from '../utils/cockHoloStyles';
import { formatCFC } from '../utils/formatNumber';
import HolographicCard from './ui/HolographicCard';
import { useGameStore } from '../store/gameStore';
import { getDisplayName } from '../utils/formatAddress';

interface CockStatsModalProps {
  cock: Cock;
  onClose: () => void;
  showHealthBars?: boolean;
  allowEdit?: boolean;
}

const CockStatsModal = ({ cock, onClose, showHealthBars = true, allowEdit = false }: CockStatsModalProps) => {
  const { t } = useTranslation();
  const updateCock = useGameStore((state) => state.updateCock);
  const cocks = useGameStore((state) => state.cocks);
  
  // Get the latest cock data from the store
  const latestCock = cocks.find(c => c.id === cock.id) || cock;
  
  // Debug: Check what's in the cock object
  console.log('[CockStatsModal] Full cock object:', cock);
  console.log('[CockStatsModal] Keys in cock:', Object.keys(cock));
  const [isClosing, setIsClosing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedName, setEditedName] = useState(latestCock.name);
  const [editedDescription, setEditedDescription] = useState(latestCock.description || '');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savingField, setSavingField] = useState<'name' | 'description' | null>(null);

  const rarityColor = latestCock.rarity === 'legendary' ? 'border-rarity-legendary' : 
                      latestCock.rarity === 'epic' ? 'border-rarity-epic' : 
                      latestCock.rarity === 'rare' ? 'border-rarity-rare' : 
                      latestCock.rarity === 'uncommon' ? 'border-rarity-uncommon' : 
                      'border-rarity-common';


  
  const { currentEnergy, maxEnergy, energyPercent } = getEnergyStats(latestCock);
  const cockImage = getCockImage(latestCock.image);
  const holographic = getCockHolographicConfig(latestCock.rarity);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200); // Match animation duration
  };

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timeout = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!isEditingName) {
      setEditedName(latestCock.name);
    }
  }, [isEditingName, latestCock.name]);

  useEffect(() => {
    if (!isEditingDescription) {
      setEditedDescription(latestCock.description || '');
    }
  }, [isEditingDescription, latestCock.description]);

  const handleSaveName = async () => {
    const trimmed = editedName.trim();
    if (!trimmed) {
      setFeedback({ type: 'error', message: t('cockStats.nameCannotBeEmpty') });
      return;
    }

    if (trimmed === latestCock.name) {
      setIsEditingName(false);
      return;
    }

    setSavingField('name');
    try {
      await updateCock(cock.id, { name: trimmed });
      setIsEditingName(false);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t('cockStats.nameUpdateFailed');
      setFeedback({ type: 'error', message });
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveDescription = async () => {
    const trimmed = editedDescription.trim();

    if (trimmed === (latestCock.description || '')) {
      setIsEditingDescription(false);
      return;
    }

    setSavingField('description');
    try {
      await updateCock(cock.id, { description: trimmed });
      setIsEditingDescription(false);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t('cockStats.descriptionUpdateFailed');
      setFeedback({ type: 'error', message });
    } finally {
      setSavingField(null);
    }
  };

  const handleCancelName = () => {
    setEditedName(latestCock.name);
    setIsEditingName(false);
  };

  const handleCancelDescription = () => {
    setEditedDescription(latestCock.description || '');
    setIsEditingDescription(false);
  };

  return (
    <div 
      className={`fixed inset-0 z-20 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
      onClick={handleClose}
    >
      <div 
        className={`relative w-full max-w-3xl border border-white/10 bg-card-dark shadow-lg shadow-primary/20 ${isClosing ? 'animate-scaleOut' : 'animate-scaleIn'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="absolute right-4 top-4 text-white/60 transition-colors hover:text-white" onClick={handleClose}>
          <span className="text-3xl">×</span>
        </button>

        <div className="p-8">
          <div className="flex items-start gap-8">
            <HolographicCard
              {...holographic}
              className={`relative h-56 w-56 flex-shrink-0 overflow-hidden border-4 ${rarityColor}`}
            >
              <img src={cockImage} alt={`${latestCock.name} portrait`} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
            </HolographicCard>

            <div className="flex-1 space-y-4 pt-2">
              {feedback && (
                <div
                  className={`rounded border px-3 py-2 text-sm font-semibold ${
                    feedback.type === 'success'
                      ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
                      : 'border-red-500/60 bg-red-500/10 text-red-200'
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              {showHealthBars && (
                <>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-bold text-white/80">{t('cockStats.health')}</span>
                      <span className="text-sm font-bold text-white">{latestCock.health}/100</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-black/30">
                      <div className="h-2.5 rounded-full bg-green-500" style={{ width: `${latestCock.health}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-bold text-white/80">{t('cockStats.energy')}</span>
                      <span className="text-sm font-bold text-white">{currentEnergy}/{maxEnergy}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-black/30">
                      <div className="h-2.5 rounded-full bg-blue-500" style={{ width: `${energyPercent}%` }}></div>
                    </div>
                  </div>
                </>
              )}

              {!showHealthBars && (
                <></>
              )}

              {/* Name with Edit */}
              <div className="pt-2 min-h-[3rem]">
                {allowEdit && isEditingName ? (
                  <div className="flex items-center gap-2 animate-fadeIn">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      maxLength={30}
                      className="flex-1 bg-black/50 border border-primary/30 rounded px-3 py-2 text-white text-2xl font-bold focus:outline-none focus:border-primary transition-all"
                      autoFocus
                    />
                    <button
                      onClick={() => void handleSaveName()}
                      disabled={savingField === 'name'}
                      className={`bg-primary text-black px-3 py-1 rounded font-semibold text-sm transition-all duration-300 ${
                        savingField === 'name' ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-[0_0_20px_rgba(232,23,23,0.8)]'
                      }`}
                    >
                      {savingField === 'name' ? t('cockStats.saving') : t('cockStats.save')}
                    </button>
                    <button
                      onClick={handleCancelName}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded font-semibold text-sm transition-all"
                    >
                      {t('cockStats.cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <h2 className="text-4xl font-bold text-white">{latestCock.name}</h2>
                      {allowEdit && (
                        <button
                          onClick={() => setIsEditingName(true)}
                          className="text-white/60 hover:text-primary transition-colors"
                          title={t('cockStats.editName')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-white/60 mt-1">
                      {t('cockStats.owner')}: {getDisplayName(latestCock.ownerUsername, latestCock.ownerAddress)}
                    </p>
                  </div>
                )}
              </div>

              {/* Description with Edit */}
              <div className="mb-4 min-h-[5rem]">
                {allowEdit && isEditingDescription ? (
                  <div className="flex flex-col gap-2 animate-fadeIn">
                    <textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      maxLength={250}
                      rows={4}
                      className="w-full bg-black/50 border border-primary/30 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-primary resize-none transition-all"
                      autoFocus
                      placeholder={t('cockStats.addDescription')}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{editedDescription.length}/250</span>
                      <button
                        onClick={() => void handleSaveDescription()}
                        disabled={savingField === 'description'}
                        className={`bg-primary text-black px-3 py-1 rounded font-semibold text-sm transition-all duration-300 ${
                          savingField === 'description' ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-[0_0_20px_rgba(232,23,23,0.8)]'
                        }`}
                      >
                        {savingField === 'description' ? t('cockStats.saving') : t('cockStats.save')}
                      </button>
                      <button
                        onClick={handleCancelDescription}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded font-semibold text-sm transition-all"
                      >
                        {t('cockStats.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 animate-fadeIn">
                    <p className="flex-1 text-sm text-white/60">
                      {latestCock.description || t('cockStats.noDescription')}
                    </p>
                    {allowEdit && (
                      <button
                        onClick={() => setIsEditingDescription(true)}
                        className="text-white/60 hover:text-primary transition-colors flex-shrink-0"
                        title={t('cockStats.editDescription')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Win/Loss Record - Always Show */}
              <div className="rounded-lg bg-background-dark/50 p-3">
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-1">{t('cockStats.wins')}</p>
                    <p className="text-xl font-bold text-green-500">{latestCock.wins}</p>
                  </div>
                  <div className="h-10 w-px bg-white/20"></div>
                  <div className="text-center">
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-1">{t('cockStats.losses')}</p>
                    <p className="text-xl font-bold text-red-500">{latestCock.losses}</p>
                  </div>
                  <div className="h-10 w-px bg-white/20"></div>
                  <div className="text-center">
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-1">$CFC EARNED</p>
                    <p className="text-xl font-bold text-primary">{formatCFC(latestCock.earningsCfc)} $CFC</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CockStatsModal;
