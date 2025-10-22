import { useEffect, useState } from 'react';
import { formatEther } from 'ethers';
import { useWalletContext } from '../contexts/WalletContext';

/**
 * Hook to fetch native BNB balance (for roulette payments)
 */
export function useNativeBalance() {
  const { address, provider, isCorrectNetwork } = useWalletContext();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address || !provider || !isCorrectNetwork) {
      setBalance(0);
      return;
    }

    let cancelled = false;

    const fetchBalance = async () => {
      try {
        setIsLoading(true);

        // Always fetch native BNB balance
        const nativeBalance = await provider.getBalance(address);
        const balanceInBnb = Number.parseFloat(formatEther(nativeBalance));

        if (!cancelled) {
          setBalance(balanceInBnb);
        }
      } catch (error) {
        console.error('[useNativeBalance] Failed to fetch BNB balance:', error);
        if (!cancelled) {
          setBalance(0);
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

  return { balance, isLoading };
}
