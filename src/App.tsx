import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Navbar from './components/Navbar';
import PageTransition from './components/PageTransition';
import Onboarding from './components/Onboarding';
import Hub from './pages/Hub';
import Shop from './pages/Shop';
import Breeding from './pages/Breeding';
import Arena from './pages/Arena';
import Spectate from './pages/Spectate';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import cfcLogo from './assets/CFC-Logo.png';
import { useGameStore } from './store/gameStore';

function App() {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);
  const refreshRestingCocks = useGameStore((state) => state.refreshRestingCocks);

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
            <Routes>
              <Route path="/" element={<Hub />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/breeding" element={<Breeding />} />
              <Route path="/arena" element={<Arena />} />
              <Route path="/spectate/:fightId" element={<Spectate />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </PageTransition>
        </main>
        <Onboarding />
      </div>
    </Router>
  );
}

export default App;