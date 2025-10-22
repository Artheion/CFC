import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BrowserProvider, getAddress } from 'ethers';
import { useAccount, useDisconnect, useSwitchChain, useWalletClient } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';

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

  return new BrowserProvider(eip1193Provider, walletClient.chain?.id);
};

export const WalletProvider = ({ children }: WalletProviderProps) => {
  const { address, chainId, isConnecting } = useAccount();
  const normalizedAddress = address ? getAddress(address) : null;
  const chainHex = typeof chainId === 'number' ? `0x${chainId.toString(16)}` : chainId ?? null;

  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchingNetwork } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { openConnectModal } = useConnectModal();

  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    if (!chainHex || !normalizedAddress) {
      setNetworkError(null);
      return;
    }

    // Check if chainId is a valid EVM chain ID (should be a number)
    // Phantom and other non-EVM wallets might report invalid chain IDs
    if (typeof chainId !== 'number' || chainId <= 0) {
      setNetworkError(null);
      return;
    }

    if (chainHex.toLowerCase() === expectedChainHex) {
      setNetworkError(null);
    } else {
      setNetworkError('Please switch to the BNB Smart Chain (BSC) network in your wallet.');
    }
  }, [chainHex, normalizedAddress, chainId]);

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

  const isCorrectNetwork = Boolean(chainHex && chainHex.toLowerCase() === expectedChainHex);

  const value = useMemo<WalletContextValue>(() => ({
    address: normalizedAddress,
    chainId: chainHex,
    provider,
    isConnecting,
    hasWalletConnector: wagmiConfig.connectors.length > 0,
    isCorrectNetwork,
    networkError,
    isSwitchingNetwork,
    connect,
    disconnect,
    switchToExpectedNetwork,
  }), [normalizedAddress, chainHex, provider, isConnecting, openConnectModal, isCorrectNetwork, networkError, isSwitchingNetwork, connect, disconnect, switchToExpectedNetwork]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return context;
};
