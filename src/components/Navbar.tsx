import { Link, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { formatEther } from 'ethers';
import { useGameStore } from '../store/gameStore';
import { ADMIN_WALLET_ADDRESS } from '../config';
import cfcLogo from '../assets/CFC-Logo.png';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { authenticateWithWallet, isCurrentlyAuthenticating } from '../utils/apiClient';
import { useWalletContext } from '../contexts/WalletContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { mapUser } from '../utils/backendMappers';

const BACKEND_ENABLED = Boolean(import.meta.env.VITE_API_BASE_URL);

const Navbar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const {
    address,
    provider,
    hasWalletConnector,
    isCorrectNetwork,
    networkError,
  } = useWalletContext();
  const user = useGameStore((state) => state.user);
  const setUser = useGameStore((state) => state.setUser);
  const refreshBackendState = useGameStore((state) => state.refreshBackendState);
  const setLoading = useGameStore((state) => state.setLoading);
  const isHydrated = useGameStore((state) => state.isHydrated);
  const logout = useGameStore((state) => state.logout);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [lastAuthAttemptAddress, setLastAuthAttemptAddress] = useState<string | null>(null);
  
  const checksummedAdmin = useMemo(() => ADMIN_WALLET_ADDRESS?.toLowerCase(), []);

  const isConnected = Boolean(address);

  // Initialize user when wallet connects and fetch real BNB balance
  useEffect(() => {
    if (!address) {
      // Clear all state when wallet disconnects
      if (user || isHydrated) {
        console.log('[Navbar] Wallet disconnected, clearing state');
        logout();
        setLastAuthAttemptAddress(null);
      }
      return;
    }

    if (!isCorrectNetwork) {
      console.log('[Navbar] ⚠️ Wrong network, waiting for correct network');
      return;
    }

    if (BACKEND_ENABLED) {
      // If already authenticated for this address, skip
      if (user && user.walletAddress === address && isHydrated) {
        return;
      }

      // Prevent duplicate authentication attempts for the same address
      if (lastAuthAttemptAddress === address) {
        console.log('[Navbar] Already attempted auth for this address, skipping');
        return;
      }

      // Check if authentication is already in progress globally
      if (isCurrentlyAuthenticating()) {
        console.log('[Navbar] Authentication already in progress globally, skipping');
        return;
      }

      let cancelled = false;
      console.log('[Navbar] 🚀 Authenticating wallet:', address);
      setLastAuthAttemptAddress(address);

      const run = async () => {
        try {
          setLoading(true);
          if (!provider) {
            throw new Error('Wallet provider unavailable');
          }
          
          const authResult = await authenticateWithWallet(provider);
          
          if (cancelled) {
            return;
          }
          
          // Set the user from auth result so refreshBackendState can proceed
          if (authResult.user) {
            const mappedUser = mapUser(authResult.user);
            setUser(mappedUser);
            
            // Wait a brief moment to ensure tokens are fully written to localStorage
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          await refreshBackendState();
          console.log('[Navbar] ✅ Authentication complete');
        } catch (error) {
          console.error('[Navbar] Failed to authenticate with backend:', error);
          
          // Reset so user can try again
          if (!cancelled) {
            setLastAuthAttemptAddress(null);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.warn('[Navbar] Authentication failed, user can retry. Error:', errorMessage);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      void run();

      return () => {
        cancelled = true;
      };
    }

    // Offline/testing fallback without backend
    if (!user && provider && isCorrectNetwork) {
      let cancelled = false;
      const fetchBalance = async () => {
        try {
          setIsBalanceLoading(true);
          const balance = await provider.getBalance(address);
          const bnbBalance = Number.parseFloat(formatEther(balance));

          setUser({
            walletAddress: address,
            bnbBalance: bnbBalance,
            isAdmin: address.toLowerCase() === checksummedAdmin,
          });
        } catch (error) {
          console.error('Error fetching balance:', error);
          setUser({
            walletAddress: address,
            bnbBalance: 0,
            isAdmin: address.toLowerCase() === checksummedAdmin,
          });
        } finally {
          if (!cancelled) {
            setIsBalanceLoading(false);
          }
        }
      };

      fetchBalance();
      return () => {
        cancelled = true;
      };
    }
  }, [address, provider, user, isHydrated, refreshBackendState, logout, setLoading, setUser, checksummedAdmin, isCorrectNetwork]);

  // Handle scroll for logo size change
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const isAdmin = Boolean(address && address.toLowerCase() === checksummedAdmin);

  const renderWalletButton = () => {
    if (!hasWalletConnector) {
      return (
        <button
          type="button"
          className="flex h-10 items-center justify-center rounded bg-gray-500 px-4 text-sm font-bold text-white opacity-60"
          title="No wallet connectors available"
          disabled
        >
          {t('common.walletUnavailable')}
        </button>
      );
    }

    return (
      <ConnectButton.Custom>
        {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
          const ready = mounted;
          const connected = ready && account && chain;

          if (!connected) {
            return (
              <button
                type="button"
                onClick={() => openConnectModal?.()}
                className="flex h-10 items-center justify-center rounded-none bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/80"
              >
                {t('common.connectWallet')}
              </button>
            );
          }

          if (chain.unsupported) {
            return (
              <button
                type="button"
                onClick={() => openChainModal?.()}
                className="flex h-10 items-center justify-center rounded-none bg-amber-500 px-4 text-sm font-bold text-black transition-colors hover:bg-amber-400"
              >
                {t('common.switchNetwork')}
              </button>
            );
          }

          return (
            <button
              type="button"
              onClick={() => openAccountModal?.()}
              className="flex h-10 items-center justify-center rounded-none border border-primary px-4 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
            >
              {account.displayName}
            </button>
          );
        }}
      </ConnectButton.Custom>
    );
  };
  
  return (
    <header className="sticky top-0 z-10 bg-background-light/80 px-4 py-3 backdrop-blur-sm dark:bg-background-dark/80 sm:px-6 lg:px-8 relative">
      {/* Border with gap for logo */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] pointer-events-none">
        <div 
          className={`absolute left-0 h-full bg-white/10 transition-all duration-300 ${
            isScrolled ? 'right-[50%]' : 'right-[52%]'
          }`}
        ></div>
        <div 
          className={`absolute right-0 h-full bg-white/10 transition-all duration-300 ${
            isScrolled ? 'left-[50%]' : 'left-[52%]'
          }`}
        ></div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Left side - Navigation */}
        <nav className="flex items-center gap-6">
          <Link
            to="/"
            className={`text-sm font-medium transition-colors ${
              location.pathname === '/'
                ? 'text-primary'
                : 'text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white'
            }`}
          >
            {t('navbar.hub')}
          </Link>
          <Link
            to="/breeding"
            className={`text-sm font-medium transition-colors ${
              location.pathname === '/breeding'
                ? 'text-primary'
                : 'text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white'
            }`}
          >
            {t('navbar.breeding')}
          </Link>
          <Link
            to="/arena"
            className={`text-sm font-medium transition-colors ${
              location.pathname === '/arena'
                ? 'text-primary'
                : 'text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white'
            }`}
          >
            {t('navbar.fighting')}
          </Link>
          <Link
            to="/leaderboard"
            className={`text-sm font-medium transition-colors ${
              location.pathname === '/leaderboard'
                ? 'text-primary'
                : 'text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white'
            }`}
          >
            {t('navbar.leaderboard')}
          </Link>
          <a
            href="https://x.com/CocksFightClub"
            target="_blank"
            rel="noopener noreferrer"
            className="text-black/60 hover:text-primary dark:text-white/60 dark:hover:text-primary transition-colors"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://t.me/cocksfightclub"
            target="_blank"
            rel="noopener noreferrer"
            className="text-black/60 hover:text-primary dark:text-white/60 dark:hover:text-primary transition-colors"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.121.099.155.232.171.326.016.094.036.308.02.475z" />
            </svg>
          </a>
        </nav>

        {/* Center - Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1">
          <Link to="/" className="block hover:opacity-80 transition-all duration-300">
            <img 
              src={cfcLogo} 
              alt="CFC Logo" 
              className={`w-auto object-contain transition-all duration-300 ${isScrolled ? 'h-12' : 'h-16'}`} 
            />
          </Link>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher />
          <Link
            to="/shop"
            className={`flex h-10 w-10 items-center justify-center bg-card-dark transition-colors hover:bg-primary/20 ${
              location.pathname === '/shop'
                ? 'text-primary'
                : 'text-white hover:text-primary'
            }`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </Link>
        {isConnected && isCorrectNetwork && (
            <Link
              to="/profile"
              className={`flex h-10 w-10 items-center justify-center bg-card-dark transition-colors hover:bg-primary/20 ${
                location.pathname === '/profile'
                  ? 'text-primary'
                  : 'text-white hover:text-primary'
              }`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          )}
          {renderWalletButton()}
        </div>
      </div>
      {address && !isCorrectNetwork && (
        <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {networkError ?? t('navbar.networkMismatch')}
        </div>
      )}
    </header>
  );
};

export default Navbar;