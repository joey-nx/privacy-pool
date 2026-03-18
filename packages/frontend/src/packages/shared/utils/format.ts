/**
 * Convert a bigint wei amount to a human-readable token string.
 * e.g. 100_500000000000000000n (18 decimals) → "100.5"
 */
export function formatTokenAmount(amount: bigint, decimals = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;

  if (remainder === 0n) return whole.toString();

  const fracStr = remainder.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/**
 * Convert a bigint field element to a checksumless hex address string.
 * e.g. 0x1234…abcd
 */
export function fieldToAddress(field: bigint): string {
  const hex = field.toString(16).padStart(40, "0");
  return `0x${hex}`;
}
