import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private treasuryWallet: ethers.Wallet | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initialize();
  }

  private initialize() {
    const rpcUrl = this.configService.get<string>('BSC_RPC_URL');
    const privateKey = this.configService.get<string>('TREASURY_PRIVATE_KEY');

    if (!rpcUrl) {
      this.logger.warn('BSC_RPC_URL not configured - blockchain features disabled');
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    if (privateKey) {
      this.treasuryWallet = new ethers.Wallet(privateKey, this.provider);
      this.logger.log(`Treasury wallet initialized: ${this.treasuryWallet.address}`);
    } else {
      this.logger.warn('TREASURY_PRIVATE_KEY not configured - auto-payouts disabled');
    }
  }

  async sendBNB(toAddress: string, amountBnb: string): Promise<string> {
    if (!this.treasuryWallet) {
      throw new Error('Treasury wallet not configured');
    }

    this.logger.log(`Sending ${amountBnb} BNB to ${toAddress}`);

    try {
      const tx = await this.treasuryWallet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amountBnb),
      });

      this.logger.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      this.logger.log(`Transaction confirmed: ${tx.hash}`);
      
      return tx.hash;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send BNB: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async getTreasuryBalance(): Promise<string> {
    if (!this.treasuryWallet || !this.provider) {
      throw new Error('Treasury wallet not configured');
    }

    try {
      const balance = await this.provider.getBalance(this.treasuryWallet.address);
      return ethers.formatEther(balance);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get treasury balance: ${errorMessage}`);
      throw error;
    }
  }

  isConfigured(): boolean {
    return this.treasuryWallet !== null;
  }

  getTreasuryAddress(): string | null {
    return this.treasuryWallet?.address || null;
  }
}
