import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider, Wallet, parseUnits, formatUnits } from 'ethers';
import EscrowABI from './CFCGameEscrow.abi.json';

export enum CockRarity {
  Common = 0,
  Uncommon = 1,
  Rare = 2,
  Epic = 3,
  Legendary = 4,
}

export enum MatchStatus {
  QUEUED = 0,
  BETTING = 1,
  ACTIVE = 2,
  COMPLETED = 3,
  CANCELLED = 4,
}

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);
  private provider: JsonRpcProvider | null = null;
  private contract: Contract | null = null;
  private wallet: Wallet | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initialize();
  }

  private initialize() {
    const rpcUrl = this.configService.get<string>('BNB_RPC_ENDPOINT');
    const privateKey = this.configService.get<string>('TREASURY_PRIVATE_KEY');
    const contractAddress = this.configService.get<string>('ESCROW_CONTRACT_ADDRESS');

    if (!rpcUrl) {
      this.logger.warn('BNB_RPC_ENDPOINT not configured - escrow features disabled');
      return;
    }

    if (!contractAddress) {
      this.logger.warn('ESCROW_CONTRACT_ADDRESS not configured - escrow features disabled');
      return;
    }

    this.provider = new JsonRpcProvider(rpcUrl);

    if (privateKey) {
      this.wallet = new Wallet(privateKey, this.provider);
      this.contract = new Contract(contractAddress, EscrowABI, this.wallet);
      this.logger.log(`Escrow initialized with treasury wallet: ${this.wallet.address}`);
      this.logger.log(`Escrow contract address: ${contractAddress}`);
    } else {
      this.logger.warn('TREASURY_PRIVATE_KEY not configured - cannot submit results');
      // Read-only contract for viewing
      this.contract = new Contract(contractAddress, EscrowABI, this.provider);
    }
  }

  isConfigured(): boolean {
    return this.contract !== null;
  }

  getContractAddress(): string | null {
    return this.configService.get<string>('ESCROW_CONTRACT_ADDRESS') || null;
  }

  /**
   * Get match details from the contract
   */
  async getMatch(matchId: string) {
    if (!this.contract) {
      throw new Error('Escrow contract not configured');
    }

    try {
      const matchBytes32 = this.stringToBytes32(matchId);
      const match = await this.contract.getMatch(matchBytes32);
      
      return {
        player1: match.player1,
        player2: match.player2,
        winner: match.winner,
        status: Number(match.status),
        winnerRarity: Number(match.winnerRarity),
        wagerAmount: formatUnits(match.wagerAmount, 18),
        createdAt: Number(match.createdAt),
        bettingClosedAt: Number(match.bettingClosedAt),
        player1TotalBets: formatUnits(match.player1TotalBets, 18),
        player2TotalBets: formatUnits(match.player2TotalBets, 18),
      };
    } catch (error) {
      this.logger.error(`Failed to get match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's bet details for a match
   */
  async getUserBet(matchId: string, userAddress: string) {
    if (!this.contract) {
      throw new Error('Escrow contract not configured');
    }

    try {
      const matchBytes32 = this.stringToBytes32(matchId);
      const bet = await this.contract.getUserBet(matchBytes32, userAddress);
      
      return {
        onPlayer1: formatUnits(bet.onPlayer1, 18),
        onPlayer2: formatUnits(bet.onPlayer2, 18),
        total: formatUnits(bet.total, 18),
      };
    } catch (error) {
      this.logger.error(`Failed to get user bet for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Get total spectator bets for a match
   */
  async getTotalSpectatorBets(matchId: string) {
    if (!this.contract) {
      throw new Error('Escrow contract not configured');
    }

    try {
      const matchBytes32 = this.stringToBytes32(matchId);
      const bets = await this.contract.getTotalSpectatorBets(matchBytes32);
      
      return {
        total: formatUnits(bets.total, 18),
        onPlayer1: formatUnits(bets.onPlayer1, 18),
        onPlayer2: formatUnits(bets.onPlayer2, 18),
      };
    } catch (error) {
      this.logger.error(`Failed to get spectator bets for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Close betting for a match (owner only)
   */
  async closeBetting(matchId: string): Promise<string> {
    if (!this.wallet || !this.contract) {
      throw new Error('Wallet not configured');
    }

    try {
      this.logger.log(`Closing betting for match ${matchId}`);
      const matchBytes32 = this.stringToBytes32(matchId);
      
      const tx = await this.contract.closeBetting(matchBytes32);
      this.logger.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      this.logger.log(`Betting closed for match ${matchId}: ${tx.hash}`);
      
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to close betting for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Submit match result (owner only)
   */
  async submitResult(matchId: string, winnerAddress: string, winnerRarity: CockRarity): Promise<string> {
    if (!this.wallet || !this.contract) {
      throw new Error('Wallet not configured');
    }

    try {
      this.logger.log(`Submitting result for match ${matchId}, winner: ${winnerAddress}, rarity: ${winnerRarity}`);
      const matchBytes32 = this.stringToBytes32(matchId);
      
      const tx = await this.contract.submitResult(matchBytes32, winnerAddress, winnerRarity);
      this.logger.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      this.logger.log(`Result submitted for match ${matchId}: ${tx.hash}`);
      
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to submit result for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Submit match result as draw (owner only)
   */
  async submitResultDraw(matchId: string): Promise<string> {
    if (!this.wallet || !this.contract) {
      throw new Error('Wallet not configured');
    }

    try {
      this.logger.log(`Submitting draw result for match ${matchId}`);
      const matchBytes32 = this.stringToBytes32(matchId);
      
      const tx = await this.contract.submitResultDraw(matchBytes32);
      this.logger.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      this.logger.log(`Draw result submitted for match ${matchId}: ${tx.hash}`);
      
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to submit draw result for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel match (owner only)
   */
  async cancelMatch(matchId: string): Promise<string> {
    if (!this.wallet || !this.contract) {
      throw new Error('Wallet not configured');
    }

    try {
      this.logger.log(`Cancelling match ${matchId}`);
      const matchBytes32 = this.stringToBytes32(matchId);
      
      const tx = await this.contract.cancelMatch(matchBytes32);
      this.logger.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      this.logger.log(`Match cancelled ${matchId}: ${tx.hash}`);
      
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to cancel match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Pause contract (owner only)
   */
  async pauseContract(): Promise<string> {
    if (!this.wallet || !this.contract) {
      throw new Error('Wallet not configured');
    }

    try {
      this.logger.log('Pausing contract');
      
      const tx = await this.contract.pause();
      this.logger.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      this.logger.log(`Contract paused: ${tx.hash}`);
      
      return tx.hash;
    } catch (error) {
      this.logger.error('Failed to pause contract:', error);
      throw error;
    }
  }

  /**
   * Unpause contract (owner only)
   */
  async unpauseContract(): Promise<string> {
    if (!this.wallet || !this.contract) {
      throw new Error('Wallet not configured');
    }

    try {
      this.logger.log('Unpausing contract');
      
      const tx = await this.contract.unpause();
      this.logger.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      this.logger.log(`Contract unpaused: ${tx.hash}`);
      
      return tx.hash;
    } catch (error) {
      this.logger.error('Failed to unpause contract:', error);
      throw error;
    }
  }

  /**
   * Get contract constants
   */
  async getContractConstants() {
    if (!this.contract) {
      throw new Error('Escrow contract not configured');
    }

    try {
      const [minWager, minBet, bettingDuration, platformFee] = await Promise.all([
        this.contract.MIN_WAGER(),
        this.contract.MIN_BET(),
        this.contract.BETTING_DURATION(),
        this.contract.platformFeePercent(),
      ]);

      return {
        minWager: formatUnits(minWager, 18),
        minBet: formatUnits(minBet, 18),
        bettingDuration: Number(bettingDuration),
        platformFeePercent: Number(platformFee),
      };
    } catch (error) {
      this.logger.error('Failed to get contract constants:', error);
      throw error;
    }
  }

  /**
   * Calculate potential payout for a user from a match
   */
  async calculatePotentialPayout(matchId: string, userAddress: string): Promise<string> {
    if (!this.contract) {
      throw new Error('Escrow contract not configured');
    }

    try {
      const matchBytes32 = this.stringToBytes32(matchId);
      const payout = await this.contract.calculatePotentialPayout(matchBytes32, userAddress);
      
      return formatUnits(payout, 18);
    } catch (error) {
      this.logger.error(`Failed to calculate payout for match ${matchId}, user ${userAddress}:`, error);
      throw error;
    }
  }

  /**
   * Claim payouts from multiple matches (batch operation)
   */
  async claimPayouts(matchIds: string[], userAddress: string): Promise<string> {
    if (!this.wallet || !this.contract) {
      throw new Error('Wallet not configured');
    }

    try {
      this.logger.log(`Claiming payouts for ${matchIds.length} matches for user ${userAddress}`);
      
      // Convert UUID strings to bytes32 format
      const matchBytes32Array = matchIds.map(id => this.stringToBytes32(id));
      
      // Call claimPayouts function (contract will transfer to the user)
      // Note: This calls the contract which transfers from escrow to user's wallet
      const tx = await this.contract.claimPayouts(matchBytes32Array);
      this.logger.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      this.logger.log(`Payouts claimed for ${matchIds.length} matches: ${tx.hash}`);
      
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to claim payouts for user ${userAddress}:`, error);
      throw error;
    }
  }

  /**
   * Claim payout from a single match
   */
  async claimPayout(matchId: string, userAddress: string): Promise<string> {
    if (!this.wallet || !this.contract) {
      throw new Error('Wallet not configured');
    }

    try {
      this.logger.log(`Claiming payout for match ${matchId} for user ${userAddress}`);
      
      const matchBytes32 = this.stringToBytes32(matchId);
      
      // Call claimPayout function
      const tx = await this.contract.claimPayout(matchBytes32);
      this.logger.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      this.logger.log(`Payout claimed for match ${matchId}: ${tx.hash}`);
      
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to claim payout for match ${matchId}, user ${userAddress}:`, error);
      throw error;
    }
  }

  /**
   * Convert UUID string to bytes32 format for contract
   */
  private stringToBytes32(str: string): string {
    // Remove hyphens from UUID
    const cleanStr = str.replace(/-/g, '');
    // Pad to 32 bytes (64 hex chars)
    return '0x' + cleanStr.padEnd(64, '0');
  }

  /**
   * Convert rarity string to enum
   */
  rarityToEnum(rarity: string): CockRarity {
    const rarityMap: Record<string, CockRarity> = {
      common: CockRarity.Common,
      uncommon: CockRarity.Uncommon,
      rare: CockRarity.Rare,
      epic: CockRarity.Epic,
      legendary: CockRarity.Legendary,
    };

    return rarityMap[rarity.toLowerCase()] ?? CockRarity.Common;
  }
}
