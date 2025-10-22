export const ADMIN_WALLET_ADDRESS = import.meta.env.VITE_ADMIN_WALLET || 'YOUR_ADMIN_WALLET_ADDRESS';
export const TREASURY_ADDRESS = import.meta.env.VITE_TREASURY_ADDRESS || 'YOUR_TREASURY_ADDRESS';
export const CFC_TOKEN_MINT = import.meta.env.VITE_CFC_TOKEN_MINT || 'YOUR_CFC_TOKEN_MINT';
export const BNB_NETWORK = (import.meta.env.VITE_BNB_NETWORK || 'testnet').toLowerCase();

const DEFAULT_RPC_ENDPOINTS: Record<string, string> = {
  mainnet: 'https://bsc-dataseed1.bnbchain.org',
  testnet: 'https://bsc-testnet.publicnode.com',
};

export const RPC_ENDPOINT =
  import.meta.env.VITE_RPC_ENDPOINT || DEFAULT_RPC_ENDPOINTS[BNB_NETWORK] || DEFAULT_RPC_ENDPOINTS.testnet;

type EvmChainConfig = {
  chainId: `0x${string}`;
  chainName: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
};

const BNB_CHAIN_CONFIGS: Record<string, EvmChainConfig> = {
  mainnet: {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    rpcUrls: [RPC_ENDPOINT || DEFAULT_RPC_ENDPOINTS.mainnet],
    blockExplorerUrls: ['https://bscscan.com'],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  },
  testnet: {
    chainId: '0x61',
    chainName: 'BNB Smart Chain Testnet',
    rpcUrls: [RPC_ENDPOINT || DEFAULT_RPC_ENDPOINTS.testnet],
    blockExplorerUrls: ['https://testnet.bscscan.com'],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  },
};

export const BNB_CHAIN_CONFIG = BNB_CHAIN_CONFIGS[BNB_NETWORK] ?? BNB_CHAIN_CONFIGS.testnet;

export const COCK_PACKS = [
  { id: '1', name: '1 Cock Pack', cockCount: 1, price: 0.1, currency: 'BNB' as const },
  { id: '2', name: '3 Cock Pack', cockCount: 3, price: 0.25, currency: 'BNB' as const },
  { id: '3', name: '5 Cock Pack', cockCount: 5, price: 0.4, currency: 'BNB' as const },
];

export const ITEMS = [
  {
    id: 'capsule',
    name: 'Energy Capsule',
    description: 'Restores 25% of maximum energy',
    price: 1000,
    image: '/assets/Items/Capsule.png',
    type: 'capsule' as const,
  },
  {
    id: 'medkit',
    name: 'Med Kit',
    description: 'Restores 50% health instantly',
    price: 1000,
    image: '/assets/Items/Medkit.png',
    type: 'medkit' as const,
  },
];