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

// Filter out invalid RPCs (frontend URLs, empty strings, etc.)
const isValidRPC = (url: string | undefined): boolean => {
  if (!url) return false;
  // Don't use frontend URLs as RPC endpoints!
  if (url.includes('cocksfightclub') || url.includes('localhost:3000') || url.includes('localhost:5173')) {
    console.warn(`[Wagmi Config] Invalid RPC detected and filtered out: ${url}`);
    return false;
  }
  return true;
};

// Multiple RPC endpoints for redundancy (will fallback automatically)
const bscMainnetRPCs = [
  RPC_ENDPOINT,
  'https://bsc-dataseed1.bnbchain.org',
  'https://bsc-dataseed2.bnbchain.org',
  'https://bsc-dataseed1.binance.org',
].filter(isValidRPC);

const bscTestnetRPCs = [
  RPC_ENDPOINT,
  'https://bsc-testnet.publicnode.com',
  'https://data-seed-prebsc-1-s1.binance.org:8545',
  'https://data-seed-prebsc-2-s1.binance.org:8545',
  'https://bsc-testnet-rpc.publicnode.com',
].filter(isValidRPC);

// Fallback to default if all RPCs are invalid
const defaultMainnetRPC = bscMainnetRPCs.length > 0 ? bscMainnetRPCs[0] : 'https://bsc-dataseed1.bnbchain.org';
const defaultTestnetRPC = bscTestnetRPCs.length > 0 ? bscTestnetRPCs[0] : 'https://bsc-testnet.publicnode.com';

console.log('[Wagmi Config] Using RPCs:', {
  mainnet: defaultMainnetRPC,
  testnet: defaultTestnetRPC,
  mainnetCount: bscMainnetRPCs.length,
  testnetCount: bscTestnetRPCs.length,
});

// Use createConfig with multiInjectedProviderDiscovery disabled
// This prevents RainbowKit from auto-detecting injected wallets like Phantom
export const wagmiConfig = createConfig({
  chains,
  connectors,
  multiInjectedProviderDiscovery: false, // KEY: This stops auto-detection of Phantom!
  transports: {
    // Mainnet: Use validated RPC endpoint
    [bsc.id]: http(BNB_NETWORK === 'mainnet' ? defaultMainnetRPC : defaultMainnetRPC, {
      timeout: 10000, // 10 second timeout
      retryCount: 3,
      retryDelay: 1000, // 1 second between retries
    }),
    // Testnet: Use validated RPC endpoint
    [bscTestnet.id]: http(BNB_NETWORK === 'testnet' ? defaultTestnetRPC : defaultTestnetRPC, {
      timeout: 10000, // 10 second timeout
      retryCount: 3,
      retryDelay: 1000, // 1 second between retries
    }),
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
