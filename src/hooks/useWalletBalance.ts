import { useEffect, useState } from 'react';
import { formatEther } from 'ethers';
import { useWalletContext } from '../contexts/WalletContext';
import { CFC_TOKEN_MINT } from '../config';

/**
 * Hook to fetch wallet balance - either native BNB or $CFC token
 * - On testnet: Returns real tBNB balance from wallet
 * - On mainnet with CFC_TOKEN_MINT set: Returns $CFC token balance
 * - Otherwise: Returns native BNB balance
 */
interface BalanceInfo {
  raw: string;
  decimals: string;
  formatted: string;
}

export function useWalletBalance() {
  const { address, provider, isCorrectNetwork } = useWalletContext();
  const [balance, setBalance] = useState<number>(0);
  const [cfcBalance, setCfcBalance] = useState<BalanceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address || !provider || !isCorrectNetwork) {
      setBalance(0);
      setCfcBalance(null);
      return;
    }

    let cancelled = false;

    const fetchBalance = async () => {
      try {
        setIsLoading(true);

        // If CFC_TOKEN_MINT is set, fetch ERC20 token balance
        if (CFC_TOKEN_MINT && CFC_TOKEN_MINT !== 'YOUR_CFC_TOKEN_MINT') {
          const { Contract, formatUnits } = await import('ethers');
          
          // Minimal ERC20 ABI for balanceOf
          const erc20Abi = [
            'function balanceOf(address owner) view returns (uint256)',
            'function decimals() view returns (uint8)'
          ];
          
          const tokenContract = new Contract(CFC_TOKEN_MINT, erc20Abi, provider);
          
          const [tokenBalance, decimals] = await Promise.all([
            tokenContract.balanceOf(address),
            tokenContract.decimals()
          ]);
          
          // Convert to human-readable format using actual token decimals
          const balanceInTokens = Number.parseFloat(formatUnits(tokenBalance, decimals));
          
          const balanceInfo: BalanceInfo = {
            raw: tokenBalance.toString(),
            decimals: decimals.toString(),
            formatted: balanceInTokens.toString()
          };
          
          console.log('[useWalletBalance] $CFC Token Balance:', balanceInfo);
          
          if (!cancelled) {
            setBalance(balanceInTokens);
            setCfcBalance(balanceInfo);
          }
        } else {
          // Fallback to native BNB balance
          const nativeBalance = await provider.getBalance(address);
          const balanceInBnb = Number.parseFloat(formatEther(nativeBalance));

          if (!cancelled) {
            setBalance(balanceInBnb);
            setCfcBalance(null); // Not using CFC tokens in this case
          }
        }
      } catch (error) {
        console.error('[useWalletBalance] Failed to fetch balance:', error);
        if (!cancelled) {
          setBalance(0);
          setCfcBalance(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchBalance();

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [address, provider, isCorrectNetwork]);

  return { balance, cfcBalance, isLoading };
}
