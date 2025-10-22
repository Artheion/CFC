import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me',
  houseWalletPrivateKey: process.env.HOUSE_WALLET_PRIVATE_KEY ?? '',
  treasuryPrivateKey: process.env.TREASURY_PRIVATE_KEY ?? '',
  treasuryAddress: process.env.TREASURY_ADDRESS ?? '',
  bnbRpcEndpoint: process.env.BNB_RPC_ENDPOINT ?? 'https://bsc-dataseed.binance.org/',
  escrowContractAddress: process.env.ESCROW_CONTRACT_ADDRESS ?? '',
  cfcTokenAddress: process.env.CFC_TOKEN_ADDRESS ?? '',
}));
