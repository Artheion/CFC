import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BrowserProvider, getAddress } from 'ethers';
import { useAccount, useDisconnect, useSwitchChain, useWalletClient } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { bsc } from 'wagmi/chains';

import { BNB_CHAIN_CONFIG } from '../config';
import { wagmiConfig } from '../wallet/config';

interface WalletContextValue {
  address: string | null;
  chainId: string | null;
  provider: BrowserProvider | null;
  isConnecting: boolean;
  hasWalletConnector: boolean;
  isCorrectNetwork: boolean;
  networkError: string | null;
  isSwitchingNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToExpectedNetwork: () => Promise<boolean>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

type WalletProviderProps = {
  children: ReactNode;
};

const expectedChainHex = BNB_CHAIN_CONFIG.chainId.toLowerCase();
const expectedChainNumeric = Number.parseInt(BNB_CHAIN_CONFIG.chainId, 16);

const walletClientToBrowserProvider = (walletClient: ReturnType<typeof useWalletClient>['data']): BrowserProvider | null => {
  if (!walletClient) {
    return null;
  }

  const eip1193Provider = walletClient as unknown as {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on?: (event: string, listener: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  };

  if (!eip1193Provider.on) {
    eip1193Provider.on = () => {};
  }

  if (!eip1193Provider.removeListener) {
    eip1193Provider.removeListener = () => {};
  }

  return new BrowserProvider(eip1193Provider, (walletClient as any)?.chain?.id);
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address, isConnected, chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  
  // Auto-switch to BSC mainnet if on wrong network
  useEffect(() => {
    const checkAndSwitchNetwork = async () => {
      if (isConnected && chain && chain.id !== bsc.id) {
        console.log(`[WalletContext] Wrong network detected: ${chain.name} (${chain.id}). Switching to BSC mainnet...`);
        try {
          await switchChainAsync({ chainId: bsc.id });
          console.log('[WalletContext] ✅ Successfully switched to BSC mainnet');
        } catch (error) {
          console.error('[WalletContext] Failed to switch network:', error);
          // Don't block connection, just warn user
        }
      }
    };
    
    checkAndSwitchNetwork();
  }, [isConnected, chain, switchChainAsync]);

  const { disconnectAsync } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const { openConnectModal } = useConnectModal();

  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    if (!chain || !address) {
      setNetworkError(null);
      return;
    }

    // Check if chainId is a valid EVM chain ID (should be a number)
    // Phantom and other non-EVM wallets might report invalid chain IDs
    if (typeof chain.id !== 'number' || chain.id <= 0) {
      setNetworkError(null);
      return;
    }

    if (chain.id === bsc.id) {
      setNetworkError(null);
    } else {
      setNetworkError('Please switch to the BNB Smart Chain (BSC) network in your wallet.');
    }
  }, [chain, address, chain.id]);

  const provider = useMemo(() => walletClientToBrowserProvider(walletClient), [walletClient]);

  const connect = useCallback(async () => {
    if (!openConnectModal) {
      throw new Error('Wallet connectors are not available.');
    }

    await openConnectModal();
  }, [openConnectModal]);

  const disconnect = useCallback(() => {
    void disconnectAsync?.();
  }, [disconnectAsync]);

  const switchToExpectedNetwork = useCallback(async () => {
    if (!switchChainAsync) {
      throw new Error('Network switching is not supported by the current wallet.');
    }

    try {
      await switchChainAsync({ chainId: expectedChainNumeric });
      setNetworkError(null);
      return true;
    } catch (error) {
      setNetworkError('Unable to switch network automatically. Please switch manually in your wallet.');
      throw error;
    }
  }, [switchChainAsync]);

  const isCorrectNetwork = Boolean(chain && chain.id === bsc.id);

  const value = useMemo<WalletContextValue>(() => ({
    address: address ? getAddress(address) : null,
    chainId: chain?.id ? `0x${chain.id.toString(16)}` : null,
    provider,
    isConnecting: false,
    hasWalletConnector: wagmiConfig.connectors.length > 0,
    isCorrectNetwork,
    networkError,
    isSwitchingNetwork: false,
    connect,
    disconnect,
    switchToExpectedNetwork,
  }), [address, chain, provider, openConnectModal, isCorrectNetwork, networkError, connect, disconnect, switchToExpectedNetwork]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return context;
};
