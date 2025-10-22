/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_BNB_NETWORK: string;
  readonly VITE_RPC_ENDPOINT: string;
  readonly VITE_ADMIN_WALLET: string;
  readonly VITE_TREASURY_ADDRESS: string;
  readonly VITE_CFC_TOKEN_ADDRESS: string;
  readonly VITE_ESCROW_CONTRACT_ADDRESS: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}
