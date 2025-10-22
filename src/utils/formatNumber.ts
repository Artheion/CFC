/**
 * Format number with commas for thousands separators
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted string like "100,000,000"
 */
export function formatNumber(value: number | undefined | null, decimals: number = 0): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0';
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format CFC token amount with commas
 * @param value - CFC amount
 * @returns Formatted string like "100,000,000 $CFC"
 */
export function formatCFC(value: number | undefined | null): string {
  return formatNumber(value, 0);
}

/**
 * Format BNB amounts with configurable decimal precision (default 4)
 * @param value - BNB amount
 * @param decimals - Fractional digits to display (default: 4)
 */
export function formatBNB(value: number | undefined | null, decimals: number = 4): string {
  return formatNumber(value, decimals);
}
