import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore';
import { updateProfile as updateProfileRequest, applyReferralCodeRequest } from '../utils/apiClient';
import { useWalletContext } from '../contexts/WalletContext';

interface OnboardingStep {
  titleKey: string;
  descriptionKey: string;
  emoji?: string;
  actionTextKey: string;
  route?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    titleKey: 'onboarding.step1Title',
    descriptionKey: 'onboarding.step1Description',
    emoji: '🐓',
    actionTextKey: 'onboarding.getStarted'
  },
  {
    titleKey: 'onboarding.step2Title',
    descriptionKey: 'onboarding.step2Description',
    emoji: '👤',
    actionTextKey: 'onboarding.next'
  },
  {
    titleKey: 'onboarding.step3Title',
    descriptionKey: 'onboarding.step3Description',
    emoji: '🏠',
    actionTextKey: 'onboarding.next',
    route: '/'
  },
  {
    titleKey: 'onboarding.step4Title',
    descriptionKey: 'onboarding.step4Description',
    emoji: '🥚',
    actionTextKey: 'onboarding.next',
    route: '/breeding'
  },
  {
    titleKey: 'onboarding.step5Title',
    descriptionKey: 'onboarding.step5Description',
    emoji: '⚔️',
    actionTextKey: 'onboarding.next',
    route: '/arena'
  },
  {
    titleKey: 'onboarding.step6Title',
    descriptionKey: 'onboarding.step6Description',
    emoji: '🎰',
    actionTextKey: 'onboarding.startPlaying',
    route: '/shop'
  }
];

const Onboarding = () => {
  const { t } = useTranslation();
  const { address, isCorrectNetwork, networkError, isSwitchingNetwork, switchToExpectedNetwork } = useWalletContext();
  const user = useGameStore((state) => state.user);
  const refreshBackendState = useGameStore((state) => state.refreshBackendState);
  const setLoading = useGameStore((state) => state.setLoading);
  const updateProfileInfo = useGameStore((state) => state.updateProfileInfo);
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [username, setUsername] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralFeedback, setReferralFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const hasReferralApplied = Boolean(user?.referredByCode);

  // Monitor authentication readiness
  useEffect(() => {
    const hasAccessToken = localStorage.getItem('cfc.accessToken');
    
    if (hasAccessToken && user) {
      if (!isAuthReady) {
        setIsAuthReady(true);
      }
    } else {
      if (isAuthReady) {
        setIsAuthReady(false);
      }
    }
  }, [user, isAuthReady]);

  useEffect(() => {
    if (!address) return;
    
    // Check if user has completed onboarding in the database (source of truth)
    const hasCompletedOnboarding = Boolean(user?.hasCompletedOnboarding);
    
    // Show onboarding if:
    // 1. User hasn't completed onboarding in the database
    // 2. User is connected
    // 3. User has data loaded (has user account)
    // 4. Authentication is complete (has access token)
    // 5. On correct network
    if (!hasCompletedOnboarding && address && user && isCorrectNetwork && isAuthReady) {
      setCurrentStep(0);
      setShowOnboarding(true);
    } else if (hasCompletedOnboarding && showOnboarding) {
      // Hide onboarding if it was already completed
      setShowOnboarding(false);
    }
  }, [address, user, isCorrectNetwork, isAuthReady, showOnboarding]);

  useEffect(() => {
    // Reset inputs when user changes (e.g., switching wallets)
    if (user?.username) {
      setUsername(user.username);
    } else {
      setUsername('');
    }

    if (user?.referredByCode) {
      setReferralCode(user.referredByCode);
    } else {
      setReferralCode('');
    }
  }, [user]);

  const handleNext = async () => {
    // If on profile setup step, persist username/referral via backend
    if (currentStep === 1) {
      const trimmedUsername = username.trim();
      const trimmedReferral = referralCode.trim().toUpperCase();
      const usernameChanged = Boolean(trimmedUsername) && trimmedUsername !== user?.username;
      const referralChanged = Boolean(trimmedReferral) && trimmedReferral !== (user?.referredByCode ?? '');
      let performedUpdate = false;

      // Frontend validation
      if (usernameChanged) {
        if (trimmedUsername.length < 3) {
          setReferralFeedback({ type: 'error', message: t('onboarding.usernameMinLength') });
          return;
        }
        if (trimmedUsername.length > 20) {
          setReferralFeedback({ type: 'error', message: t('onboarding.usernameMaxLength') });
          return;
        }
      }

      if (referralChanged) {
        if (trimmedReferral.length < 6) {
          setReferralFeedback({ type: 'error', message: t('onboarding.referralMinLength') });
          return;
        }
        if (trimmedReferral.length > 32) {
          setReferralFeedback({ type: 'error', message: t('onboarding.referralMaxLength') });
          return;
        }
        if (!/^[A-Z0-9\-]+$/.test(trimmedReferral)) {
          setReferralFeedback({ type: 'error', message: t('onboarding.referralInvalidChars') });
          return;
        }
      }

      try {
        if (usernameChanged || referralChanged) {
          performedUpdate = true;
          setLoading(true);

          if (usernameChanged) {
            await updateProfileRequest({ username: trimmedUsername });
          }

          if (referralChanged) {
            await applyReferralCodeRequest(trimmedReferral);
            setReferralFeedback({ type: 'success', message: t('onboarding.referralApplied', { code: trimmedReferral }) });
          } else if (user?.referredByCode) {
            setReferralFeedback({ type: 'success', message: t('onboarding.referralApplied', { code: user.referredByCode }) });
          } else {
            setReferralFeedback(null);
          }

          await refreshBackendState();
        } else if (user?.referredByCode) {
          setReferralFeedback({ type: 'success', message: `Referral code ${user.referredByCode} applied.` });
        } else {
          setReferralFeedback(null);
        }
      } catch (error) {
        let message = t('onboarding.profileUpdateFailed');
        if (error instanceof Error) {
          message = error.message;
          // If unauthorized, suggest re-connecting wallet
          if (message.includes('Unauthorized') || message.includes('401')) {
            message = t('onboarding.sessionExpired');
          }
        }
        setReferralFeedback({ type: 'error', message });
        if (performedUpdate) {
          setLoading(false);
        }
        return;
      } finally {
        if (performedUpdate) {
          setLoading(false);
        }
      }
    }

    if (currentStep === ONBOARDING_STEPS.length - 1) {
      // Last step - complete onboarding
      completeOnboarding();
    } else {
      // Move to next step
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      
      // Navigate to next step's route if specified
      const nextStepData = ONBOARDING_STEPS[nextStep];
      if (nextStepData.route) {
        navigate(nextStepData.route);
      }
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    // Mark as complete in the database (source of truth)
    try {
      await updateProfileInfo({ hasCompletedOnboarding: true });
      
      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('[Onboarding] Failed to mark onboarding complete:', error);
      // Still hide onboarding even if update fails to prevent blocking user
    }
    
    setShowOnboarding(false);
    navigate('/');
  };

  if (!showOnboarding) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-end p-6 pointer-events-none">
      <div className="relative w-full max-w-md pointer-events-auto">
        {/* Onboarding Card */}
        <div className="bg-card-dark border border-white/10 shadow-2xl shadow-primary/20 rounded-lg overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1 bg-black/40">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Header with Skip */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {step.emoji && (
                  <span className="text-3xl">{step.emoji}</span>
                )}
                <h3 className="text-xl font-bold text-white">{t(step.titleKey)}</h3>
              </div>
              <button
                onClick={handleSkip}
                className="text-white/40 hover:text-white/60 transition-colors text-xs"
              >
                {t('onboarding.skip')}
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-4">
              {ONBOARDING_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    index === currentStep 
                      ? 'bg-primary' 
                      : index < currentStep 
                      ? 'bg-primary/50' 
                      : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Description */}
            <p className="text-sm text-white/70 mb-6">
              {t(step.descriptionKey)}
            </p>

            {/* Profile Setup Form (step 2) */}
            {currentStep === 1 && (
              <div className="bg-black/40 border border-white/10 rounded-lg p-4 mb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    {t('onboarding.usernameLabel')}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setReferralFeedback(null);
                    }}
                    placeholder={t('onboarding.usernamePlaceholder')}
                    maxLength={20}
                    className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-primary transition-colors"
                  />
                  <p className="text-xs text-white/40 mt-1">{username.length}/20 {username.trim().length > 0 && username.trim().length < 3 && `(${t('onboarding.minimum')} 3)`}</p>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    {t('onboarding.referralCodeLabel')}
                  </label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => {
                      setReferralCode(e.target.value.toUpperCase());
                      setReferralFeedback(null);
                    }}
                    placeholder={t('onboarding.referralCodePlaceholder')}
                    disabled={hasReferralApplied}
                    maxLength={32}
                    className={`w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-primary transition-colors uppercase ${hasReferralApplied ? 'opacity-70 cursor-not-allowed' : ''}`}
                  />
                  {referralFeedback && (
                    <p
                      className={`mt-1 text-xs ${
                        referralFeedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {referralFeedback.message}
                    </p>
                  )}
                  {hasReferralApplied && !referralFeedback && user?.referredByCode && (
                    <p className="mt-1 text-xs text-emerald-400">
                      {t('onboarding.referralApplied', { code: user.referredByCode })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 text-sm font-bold transition-all rounded"
                >
                  {t('onboarding.back')}
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex-1 bg-primary hover:brightness-110 text-white py-2.5 text-sm font-bold transition-all rounded"
              >
                {t(step.actionTextKey)}
              </button>
            </div>

            {/* Helper Text */}
            <p className="text-center text-white/40 text-xs mt-3">
              {t('onboarding.stepCount', { current: currentStep + 1, total: ONBOARDING_STEPS.length })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
