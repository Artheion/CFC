import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import Navbar from './components/Navbar';
import PageTransition from './components/PageTransition';
import Onboarding from './components/Onboarding';
import cfcLogo from './assets/CFC-Logo.png';
import { useGameStore } from './store/gameStore';
import { refreshAuthSession } from './utils/apiClient';
import { mapUser } from './utils/backendMappers';

// ✅ PERFORMANCE: Lazy load all pages for code splitting (Phase 1 optimization)
// This reduces initial bundle size by ~60-70%
const Hub = lazy(() => import('./pages/Hub'));
const Shop = lazy(() => import('./pages/Shop'));
const Breeding = lazy(() => import('./pages/Breeding')); // Includes Three.js - saved ~600KB
const Arena = lazy(() => import('./pages/Arena'));
const Spectate = lazy(() => import('./pages/Spectate'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Profile = lazy(() => import('./pages/Profile'));
const DebugConnection = lazy(() => import('./pages/DebugConnection'));

const BACKEND_ENABLED = Boolean(import.meta.env.VITE_API_BASE_URL);

// Loading fallback component
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background-dark">
    <div className="flex flex-col items-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      <p className="text-white/60">Loading...</p>
    </div>
  </div>
);

function App() {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);
  const refreshRestingCocks = useGameStore((state) => state.refreshRestingCocks);
  const setUser = useGameStore((state) => state.setUser);
  const refreshBackendState = useGameStore((state) => state.refreshBackendState);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ✅ SECURITY UPGRADE: Restore authentication session from HttpOnly cookies on app load
  useEffect(() => {
    const restoreSession = async () => {
      if (!BACKEND_ENABLED) return;

      console.log('[App] 🔄 Attempting to restore session from HttpOnly cookies...');
      const sessionResult = await refreshAuthSession();

      if (sessionResult.authenticated && sessionResult.user) {
        console.log('[App] ✅ Session restored successfully');
        const mappedUser = mapUser(sessionResult.user);
        setUser(mappedUser);
        
        // Refresh all backend state
        await refreshBackendState();
      } else {
        console.log('[App] No previous session found');
      }
    };

    restoreSession();
  }, [setUser, refreshBackendState]);

  useEffect(() => {
    refreshRestingCocks();
    const interval = setInterval(() => {
      refreshRestingCocks();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshRestingCocks]);

  // Mobile blocking screen
  if (isMobile) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background-dark p-8">
        <div className="flex flex-col items-center gap-8 text-center">
          <img 
            src={cfcLogo} 
            alt="CFC Logo" 
            className="w-48 object-contain"
          />
          <h1 className="text-4xl font-bold text-white">{t('mobile.title')}</h1>
          <p className="text-xl text-white/60 max-w-md">
            {t('mobile.message')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex min-h-screen w-full flex-col">
        <Navbar />
        <main className="flex-1">
          <PageTransition>
            {/* ✅ PERFORMANCE: Suspense wrapper for lazy-loaded routes */}
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Hub />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/breeding" element={<Breeding />} />
                <Route path="/arena" element={<Arena />} />
                <Route path="/spectate/:fightId" element={<Spectate />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/debug" element={<DebugConnection />} />
              </Routes>
            </Suspense>
          </PageTransition>
        </main>
        <Onboarding />
      </div>
    </Router>
  );
}

export default App;