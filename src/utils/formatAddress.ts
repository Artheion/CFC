// Format wallet address to "abc...xyz" style
export const formatWalletAddress = (address: string, startChars = 4, endChars = 3): string => {
  if (!address || address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

// Get display name (username or formatted wallet address)
export const getDisplayName = (username?: string, walletAddress?: string): string => {
  if (username && username.trim()) {
    return username;
  }
  if (walletAddress) {
    return formatWalletAddress(walletAddress);
  }
  return 'Unknown';
};
