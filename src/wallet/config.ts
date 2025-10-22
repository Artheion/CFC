import { connectorsForWallets, darkTheme } from '@rainbow-me/rainbowkit';
import {
  walletConnectWallet,
  metaMaskWallet,
  trustWallet,
  coinbaseWallet,
  ledgerWallet,
  binanceWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { bsc, bscTestnet } from 'wagmi/chains';
import { http, createConfig } from 'wagmi';

import { BNB_NETWORK, RPC_ENDPOINT } from '../config';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  // eslint-disable-next-line no-console
  console.warn('VITE_WALLETCONNECT_PROJECT_ID is not set. RainbowKit WalletConnect features will be limited.');
}

const chains = [bsc, bscTestnet] as const;
const defaultChain = BNB_NETWORK === 'mainnet' ? bsc : bscTestnet;

// Only include wallets officially supported by BNB Chain
// Source: https://www.bnbchain.org/en/wallets
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [
        metaMaskWallet,        // Official BNB Chain wallet
        trustWallet,           // Official BNB Chain wallet
        binanceWallet,         // Official BNB Chain wallet
        coinbaseWallet,        // Popular EVM wallet
        walletConnectWallet,   // Universal connector
        ledgerWallet,          // Hardware wallet (official BNB Chain)
      ],
    },
  ],
  {
    projectId: projectId || 'demo',
    appName: 'Cocks Fight Club',
    appDescription: 'CFC dApp',
    appUrl: typeof window !== 'undefined' ? window.location.origin : 'https://cocksfightclub.example',
  },
);

// Use createConfig with multiInjectedProviderDiscovery disabled
// This prevents RainbowKit from auto-detecting injected wallets like Phantom
export const wagmiConfig = createConfig({
  chains,
  connectors,
  multiInjectedProviderDiscovery: false, // KEY: This stops auto-detection of Phantom!
  transports: {
    [bsc.id]: http(BNB_NETWORK === 'mainnet' ? RPC_ENDPOINT : 'https://bsc-dataseed1.bnbchain.org'),
    [bscTestnet.id]: http(BNB_NETWORK === 'testnet' ? RPC_ENDPOINT : 'https://bsc-testnet.publicnode.com'),
  },
  ssr: false,
});

export const wagmiChains = chains;
export const wagmiInitialChain = defaultChain;
export const rainbowTheme = darkTheme({
  accentColor: '#ff2727',
  accentColorForeground: '#ffffff',
  borderRadius: 'none',
  fontStack: 'system',
});
