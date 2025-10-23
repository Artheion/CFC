import { useState, useCallback } from 'react';
import { Contract, parseUnits, formatUnits, BrowserProvider, JsonRpcProvider } from 'ethers';
import { useWalletContext } from '../contexts/WalletContext';
import EscrowABI from '../contracts/CFCGameEscrow.abi.json';
import ERC20ABI from '../contracts/ERC20.abi.json';
import { RPC_ENDPOINT } from '../config';

// Get from environment variables
const ESCROW_CONTRACT_ADDRESS = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS || '';
const CFC_TOKEN_ADDRESS = import.meta.env.VITE_CFC_TOKEN_ADDRESS || '';

// Create a read-only provider as fallback for contract verification
let readOnlyProvider: JsonRpcProvider | null = null;
const getReadOnlyProvider = () => {
  if (!readOnlyProvider && RPC_ENDPOINT) {
    try {
      readOnlyProvider = new JsonRpcProvider(RPC_ENDPOINT);
      console.log('[getReadOnlyProvider] Created JsonRpcProvider for RPC:', RPC_ENDPOINT);
    } catch (err) {
      console.error('[getReadOnlyProvider] Failed to create JsonRpcProvider:', err);
    }
  }
  return readOnlyProvider;
};

export interface ContractInfo {
  configured: boolean;
  contractAddress?: string;
  minWager?: string;
  minBet?: string;
  bettingDuration?: number;
  platformFeePercent?: number;
}

export interface CreateMatchParams {
  matchId: string;
  wagerAmount: string; // In CFC tokens (e.g., "1000")
}

export interface JoinMatchParams {
  matchId: string;
  wagerAmount: string;
}

export interface PlaceBetParams {
  matchId: string;
  playerChoice: 1 | 2;
  amount: string;
}

export const useEscrowContract = () => {
  const { provider: walletProvider, address } = useWalletContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log('[useEscrowContract] Hook initialized with:', {
    hasProvider: !!walletProvider,
    providerType: walletProvider?.constructor?.name,
    address,
    escrowConfigured: Boolean(ESCROW_CONTRACT_ADDRESS && CFC_TOKEN_ADDRESS),
    rpcEndpoint: RPC_ENDPOINT,
    tokenAddress: CFC_TOKEN_ADDRESS,
    escrowAddress: ESCROW_CONTRACT_ADDRESS,
  });

  const clearError = useCallback(() => setError(null), []);

  // Convert UUID to bytes32 format for contract
  const uuidToBytes32 = (uuid: string): string => {
    const cleanUuid = uuid.replace(/-/g, '');
    return '0x' + cleanUuid.padEnd(64, '0');
  };

  // Get contract instances
  const getContracts = useCallback(async () => {
    console.log('[getContracts] Initializing...', {
      hasWalletProvider: !!walletProvider,
      walletProviderType: walletProvider?.constructor?.name,
      address,
      escrowAddress: ESCROW_CONTRACT_ADDRESS,
      tokenAddress: CFC_TOKEN_ADDRESS,
    });
    
    if (!walletProvider || !address) {
      throw new Error('Wallet not connected');
    }

    if (!ESCROW_CONTRACT_ADDRESS || !CFC_TOKEN_ADDRESS) {
      throw new Error('Contract addresses not configured');
    }

    // walletProvider from WalletContext is already a BrowserProvider, so we can use it directly
    const signer = await walletProvider.getSigner();
    console.log('[getContracts] Signer obtained:', await signer.getAddress());

    // Verify network
    const network = await walletProvider.getNetwork();
    console.log('[getContracts] Connected to network:', {
      chainId: network.chainId.toString(),
      name: network.name,
    });

    // Check if contracts exist at the addresses (have bytecode)
    // Try with wallet provider first, fallback to read-only provider
    try {
      console.log('[getContracts] Verifying contracts on-chain...');
      
      let tokenCode: string;
      let escrowCode: string;
      
      try {
        tokenCode = await walletProvider.getCode(CFC_TOKEN_ADDRESS);
        escrowCode = await walletProvider.getCode(ESCROW_CONTRACT_ADDRESS);
        console.log('[getContracts] Using wallet provider for verification');
      } catch (walletProviderErr) {
        console.warn('[getContracts] Wallet provider failed, trying read-only provider:', walletProviderErr);
        const rpcProvider = getReadOnlyProvider();
        if (!rpcProvider) {
          throw new Error('Both wallet provider and RPC provider are unavailable');
        }
        tokenCode = await rpcProvider.getCode(CFC_TOKEN_ADDRESS);
        escrowCode = await rpcProvider.getCode(ESCROW_CONTRACT_ADDRESS);
        console.log('[getContracts] Using read-only RPC provider for verification');
      }
      
      if (tokenCode === '0x' || tokenCode === '0x0') {
        throw new Error(
          `Token contract not found at ${CFC_TOKEN_ADDRESS} on chain ${network.chainId}. ` +
          `Please verify the contract is deployed on BSC Testnet (chainId: 97) or check your network connection.`
        );
      }
      
      if (escrowCode === '0x' || escrowCode === '0x0') {
        throw new Error(
          `Escrow contract not found at ${ESCROW_CONTRACT_ADDRESS} on chain ${network.chainId}. ` +
          `Please verify the contract is deployed on BSC Testnet (chainId: 97).`
        );
      }
      
      console.log('[getContracts] ✅ Both contracts verified to exist on-chain');
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        throw err; // Re-throw our custom errors
      }
      console.error('[getContracts] Error verifying contracts:', err);
      throw new Error(
        `Unable to verify contracts on-chain. This may be due to: ` +
        `\n1. Wrong network (expected BSC Testnet chainId: 97)` +
        `\n2. RPC connection issues - try a different RPC endpoint` +
        `\n3. Invalid contract addresses` +
        `\n\nOriginal error: ${err.message || 'Unknown error'}`
      );
    }

    const escrowContract = new Contract(ESCROW_CONTRACT_ADDRESS, EscrowABI, signer);
    const tokenContract = new Contract(CFC_TOKEN_ADDRESS, ERC20ABI, signer);
    console.log('[getContracts] Contracts instantiated');

    return { escrowContract, tokenContract, signer };
  }, [walletProvider, address]);

  /**
   * Check if user has approved enough tokens to the escrow contract
   */
  const checkAllowance = useCallback(async (amount: string): Promise<boolean> => {
    try {
      const { tokenContract } = await getContracts();
      const amountWei = parseUnits(amount, 18);
      const allowance = await tokenContract.allowance(address, ESCROW_CONTRACT_ADDRESS);
      return BigInt(allowance.toString()) >= BigInt(amountWei.toString());
    } catch (err) {
      console.error('Error checking allowance:', err);
      return false;
    }
  }, [getContracts, address]);

  /**
   * Approve CFC tokens to escrow contract
   * @param skipLoadingManagement - If true, won't manage loading state (used when called from createMatch/joinMatch)
   */
  const approveTokens = useCallback(async (amount: string, skipLoadingManagement = false): Promise<{ success: boolean; txHash?: string }> => {
    try {
      if (!skipLoadingManagement) {
        setLoading(true);
      }
      setError(null);

      const { tokenContract } = await getContracts();
      const amountWei = parseUnits(amount, 18);

      console.log(`Approving ${amount} CFC tokens to escrow contract...`);
      console.log(`Token contract: ${CFC_TOKEN_ADDRESS}`);
      console.log(`Escrow contract: ${ESCROW_CONTRACT_ADDRESS}`);
      console.log(`Amount: ${amountWei.toString()} wei`);
      
      const tx = await tokenContract.approve(ESCROW_CONTRACT_ADDRESS, amountWei);
      console.log('✅ Approval transaction sent:', tx.hash);
      
      await tx.wait();
      console.log('✅ Approval confirmed!');
      
      return { success: true, txHash: tx.hash };
    } catch (err: any) {
      console.error('❌ Approval error:', err);
      console.error('❌ Error code:', err.code);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error details:', err.details);
      
      let message = 'Failed to approve tokens';
      
      // Detect specific error types
      if (err.code === 'ACTION_REJECTED' || err.message?.toLowerCase().includes('user rejected')) {
        message = 'Transaction was rejected by user';
      } else if (err.code === -32603 || err.message?.includes('internal error') || err.message?.includes('does not have a transaction hash')) {
        message = 'RPC connection error. The BSC Testnet RPC is having issues. Please try again in a few moments, or switch to a different RPC in MetaMask settings.';
      } else if (err.message?.includes('insufficient funds')) {
        message = 'Insufficient BNB for gas fees. You need BNB in your wallet to pay for transaction fees.';
      } else if (err.message?.includes('nonce')) {
        message = 'Nonce error. Please reset your MetaMask account (Settings > Advanced > Clear activity tab data) and try again.';
      } else if (err.message?.includes('timeout') || err.message?.includes('timed out')) {
        message = 'Transaction timeout. The RPC endpoint is too slow. Please try again or switch RPC in MetaMask.';
      } else if (err.message?.includes('network') || err.message?.includes('connection')) {
        message = 'Network connection issue. Please check your internet connection and try again.';
      } else if (err.message) {
        message = err.message;
      }
      
      console.error('❌ User-friendly error message:', message);
      setError(message);
      return { success: false };
    } finally {
      if (!skipLoadingManagement) {
        setLoading(false);
      }
    }
  }, [getContracts]);

  /**
   * Create a new match on the escrow contract
   */
  const createMatch = useCallback(async (params: CreateMatchParams): Promise<{ success: boolean; txHash?: string }> => {
    console.log('🚀 [createMatch] ===== FUNCTION CALLED =====');
    console.log('🚀 [createMatch] Starting with params:', params);
    console.log('🚀 [createMatch] Current state:', { 
      hasWalletProvider: !!walletProvider, 
      address,
      loading,
      error,
    });
    
    try {
      console.log('🚀 [createMatch] Entering try block...');
      setLoading(true);
      setError(null);

      console.log('📝 [createMatch] Step 1: Getting contracts...');
      const { escrowContract, tokenContract } = await getContracts();
      console.log('✅ [createMatch] Contracts obtained');
      console.log('[createMatch] Escrow contract address:', ESCROW_CONTRACT_ADDRESS);
      console.log('[createMatch] Token contract address:', CFC_TOKEN_ADDRESS);

      // Check token balance - use read-only contract for balance check (doesn't need signer)
      console.log('📝 [createMatch] Step 2: Checking token balance...');
      
      let balance;
      try {
        // Try with signer first
        balance = await tokenContract.balanceOf(address);
        console.log('[createMatch] Balance check using wallet provider');
      } catch (balanceErr) {
        console.warn('[createMatch] Balance check with wallet failed, trying read-only provider:', balanceErr);
        // Fallback to read-only provider
        const rpcProvider = getReadOnlyProvider();
        if (!rpcProvider) {
          throw new Error('Unable to check balance: both wallet and RPC providers failed');
        }
        const readOnlyTokenContract = new Contract(CFC_TOKEN_ADDRESS, ERC20ABI, rpcProvider);
        balance = await readOnlyTokenContract.balanceOf(address);
        console.log('[createMatch] Balance check using read-only RPC provider');
      }
      
      const wagerWei = parseUnits(params.wagerAmount, 18);
      console.log('[createMatch] Balance:', formatUnits(balance, 18), 'CFC | Wager needed:', params.wagerAmount, 'CFC');
      
      if (BigInt(balance.toString()) < BigInt(wagerWei.toString())) {
        throw new Error(`Insufficient CFC balance. Need ${params.wagerAmount} CFC`);
      }
      console.log('✅ [createMatch] Token balance sufficient');

      // Check allowance first
      console.log('📝 [createMatch] Step 3: Checking token allowance...');
      const hasAllowance = await checkAllowance(params.wagerAmount);
      console.log('[createMatch] Has allowance:', hasAllowance);
      
      if (!hasAllowance) {
        console.log('⚠️ [createMatch] Insufficient allowance, requesting approval...');
        // Pass skipLoadingManagement=true to keep loading state active
        const approvalResult = await approveTokens(params.wagerAmount, true);
        if (!approvalResult.success) {
          throw new Error('Token approval failed or rejected by user');
        }
        console.log('✅ [createMatch] Token approval successful');
      }

      console.log('📝 [createMatch] Step 4: Preparing contract call...');
      const matchBytes32 = uuidToBytes32(params.matchId);

      console.log('📝 [createMatch] Contract call parameters:', {
        matchId: params.matchId,
        matchBytes32,
        wagerAmount: params.wagerAmount,
        wagerWei: wagerWei.toString(),
        contractAddress: ESCROW_CONTRACT_ADDRESS,
      });

      console.log('📝 [createMatch] Step 5: Calling escrowContract.createMatch()...');
      const tx = await escrowContract.createMatch(matchBytes32, wagerWei);
      console.log('✅ [createMatch] Transaction sent! Hash:', tx.hash);
      
      console.log('📝 [createMatch] Step 6: Waiting for confirmation...');
      await tx.wait();
      console.log('✅ [createMatch] Transaction confirmed! Match created on contract!');
      
      return { success: true, txHash: tx.hash };
    } catch (err: any) {
      console.error('❌ [createMatch] CAUGHT ERROR:', err);
      let message = 'Failed to create match on contract';
      
      // Parse specific error types with more helpful messages
      if (err.code === 'ACTION_REJECTED' || err.message?.includes('user rejected')) {
        message = 'Transaction rejected by user';
      } else if (err.message?.includes('insufficient funds')) {
        message = 'Insufficient BNB for gas fees. Please add BNB to your wallet to pay for transaction fees.';
      } else if (err.message?.includes('missing revert data') || err.code === 'CALL_EXCEPTION') {
        message = 
          'Contract call failed - the contract may not exist at the configured address on your current network.\n\n' +
          `Expected network: BSC Testnet (chainId: 97)\n` +
          `Token contract: ${CFC_TOKEN_ADDRESS}\n` +
          `Escrow contract: ${ESCROW_CONTRACT_ADDRESS}\n\n` +
          'Please check:\n' +
          '1. You are connected to BSC Testnet in MetaMask\n' +
          '2. The contracts are deployed on BSC Testnet\n' +
          '3. Your RPC connection is working';
      } else if (err.message?.includes('not found')) {
        // Our custom contract not found errors
        message = err.message;
      } else if (err.message?.includes('execution reverted')) {
        // Extract revert reason if available
        const revertMatch = err.message.match(/reverted with reason string '(.+?)'/);
        if (revertMatch) {
          message = `Contract error: ${revertMatch[1]}`;
        } else {
          message = 'Contract call reverted. Check if you have enough CFC tokens and contract is configured correctly.';
        }
      } else if (err.reason) {
        message = err.reason;
      } else if (err.message) {
        message = err.message;
      }
      
      console.error('❌ [createMatch] Detailed error breakdown:', {
        parsedMessage: message,
        errorCode: err.code,
        errorReason: err.reason,
        errorMessage: err.message,
        errorData: err.data,
        errorInfo: err.info,
        fullErrorObject: err,
      });
      
      // Also log the raw error
      console.error('❌ [createMatch] Raw error:', err);
      
      setError(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [getContracts, checkAllowance, approveTokens]);

  /**
   * Join an existing match on the escrow contract
   */
  const joinMatch = useCallback(async (params: JoinMatchParams): Promise<{ success: boolean; txHash?: string }> => {
    try {
      setLoading(true);
      setError(null);

      // Check allowance first
      const hasAllowance = await checkAllowance(params.wagerAmount);
      if (!hasAllowance) {
        // Pass skipLoadingManagement=true to keep loading state active
        const approvalResult = await approveTokens(params.wagerAmount, true);
        if (!approvalResult.success) {
          throw new Error('Token approval failed');
        }
      }

      const { escrowContract } = await getContracts();
      const matchBytes32 = uuidToBytes32(params.matchId);

      console.log(`Joining match on escrow contract:`, {
        matchId: params.matchId,
        matchBytes32,
        wagerAmount: params.wagerAmount,
      });

      const tx = await escrowContract.joinMatch(matchBytes32);
      console.log('Join match transaction sent:', tx.hash);
      
      await tx.wait();
      console.log('Match joined on contract!');
      
      return { success: true, txHash: tx.hash };
    } catch (err: any) {
      const message = err.message || 'Failed to join match on contract';
      console.error('Join match error:', err);
      setError(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [getContracts, checkAllowance, approveTokens]);

  /**
   * Place a bet on a match
   */
  const placeBet = useCallback(async (params: PlaceBetParams): Promise<{ success: boolean; txHash?: string }> => {
    try {
      setLoading(true);
      setError(null);

      // Check allowance first
      const hasAllowance = await checkAllowance(params.amount);
      if (!hasAllowance) {
        // Pass skipLoadingManagement=true to keep loading state active
        const approvalResult = await approveTokens(params.amount, true);
        if (!approvalResult.success) {
          throw new Error('Token approval failed');
        }
      }

      const { escrowContract } = await getContracts();
      const matchBytes32 = uuidToBytes32(params.matchId);
      const amountWei = parseUnits(params.amount, 18);

      console.log(`Placing bet on escrow contract:`, {
        matchId: params.matchId,
        playerChoice: params.playerChoice,
        amount: params.amount,
      });

      const tx = await escrowContract.placeBet(matchBytes32, params.playerChoice, amountWei);
      console.log('Place bet transaction sent:', tx.hash);
      
      await tx.wait();
      console.log('Bet placed on contract!');
      
      return { success: true, txHash: tx.hash };
    } catch (err: any) {
      const message = err.message || 'Failed to place bet on contract';
      console.error('Place bet error:', err);
      setError(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [getContracts, checkAllowance, approveTokens]);

  /**
   * Claim payout from a completed match
   */
  const claimPayout = useCallback(async (matchId: string): Promise<{ success: boolean; txHash?: string; amount?: string }> => {
    try {
      setLoading(true);
      setError(null);

      const { escrowContract } = await getContracts();
      const matchBytes32 = uuidToBytes32(matchId);

      // Calculate potential payout first
      const potentialPayout = await escrowContract.calculatePotentialPayout(matchBytes32, address);
      const payoutAmount = formatUnits(potentialPayout, 18);

      if (parseFloat(payoutAmount) === 0) {
        throw new Error('No payout available for this match');
      }

      console.log(`Claiming payout from match ${matchId}: ${payoutAmount} CFC`);

      const tx = await escrowContract.claimPayout(matchBytes32);
      console.log('Claim payout transaction sent:', tx.hash);
      
      await tx.wait();
      console.log('Payout claimed!');
      
      return { success: true, txHash: tx.hash, amount: payoutAmount };
    } catch (err: any) {
      const message = err.message || 'Failed to claim payout';
      console.error('Claim payout error:', err);
      setError(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [getContracts, address]);

  /**
   * Get match details from contract
   */
  const getMatchDetails = useCallback(async (matchId: string) => {
    try {
      const { escrowContract } = await getContracts();
      const matchBytes32 = uuidToBytes32(matchId);
      const match = await escrowContract.getMatch(matchBytes32);
      
      return {
        player1: match.player1,
        player2: match.player2,
        winner: match.winner,
        status: Number(match.status),
        wagerAmount: formatUnits(match.wagerAmount, 18),
        player1TotalBets: formatUnits(match.player1TotalBets, 18),
        player2TotalBets: formatUnits(match.player2TotalBets, 18),
      };
    } catch (err: any) {
      console.error('Error getting match details:', err);
      throw err;
    }
  }, [getContracts]);

  return {
    loading,
    error,
    clearError,
    // Contract interaction methods
    approveTokens,
    createMatch,
    joinMatch,
    placeBet,
    claimPayout,
    getMatchDetails,
    checkAllowance,
    // Configuration
    escrowAddress: ESCROW_CONTRACT_ADDRESS,
    tokenAddress: CFC_TOKEN_ADDRESS,
    isConfigured: Boolean(ESCROW_CONTRACT_ADDRESS && CFC_TOKEN_ADDRESS),
  };
};
