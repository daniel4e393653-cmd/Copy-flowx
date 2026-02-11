import BN from "bn.js";
import Decimal from "decimal.js";

/**
 * TickMath utility for converting between ticks and sqrtPriceX64
 * Based on CLMM math: price = 1.0001^tick
 * sqrtPriceX64 = sqrt(price) * 2^64
 */

const Q64 = new BN(2).pow(new BN(64));
const MIN_TICK = -443636;
const MAX_TICK = 443636;

/**
 * Convert tick index to sqrtPriceX64
 * @param tick - Tick index
 * @returns sqrtPriceX64 as BN
 */
export function tickIndexToSqrtPriceX64(tick: number): BN {
  if (tick < MIN_TICK || tick > MAX_TICK) {
    throw new Error(`Tick ${tick} is out of bounds [${MIN_TICK}, ${MAX_TICK}]`);
  }

  // Calculate price = 1.0001^tick
  const price = new Decimal(1.0001).pow(tick);
  
  // Calculate sqrt(price)
  const sqrtPrice = price.sqrt();
  
  // Multiply by 2^64
  const sqrtPriceX64 = sqrtPrice.mul(new Decimal(2).pow(64));
  
  // Convert to BN
  return new BN(sqrtPriceX64.toFixed(0));
}

/**
 * Convert sqrtPriceX64 to tick index
 * @param sqrtPriceX64 - sqrtPriceX64 as BN
 * @returns Approximate tick index
 */
export function sqrtPriceX64ToTickIndex(sqrtPriceX64: BN): number {
  // Divide by 2^64 to get sqrtPrice
  const sqrtPriceDecimal = new Decimal(sqrtPriceX64.toString()).div(
    new Decimal(2).pow(64)
  );
  
  // Square to get price
  const price = sqrtPriceDecimal.pow(2);
  
  // Calculate tick = log(price) / log(1.0001)
  const tick = price.log(1.0001);
  
  // Round to nearest integer
  return Math.round(tick.toNumber());
}

/**
 * Convert sqrtPriceX64 to human-readable price
 * @param sqrtPriceX64 - sqrtPriceX64 as BN or string
 * @param decimalsA - Decimals of token A
 * @param decimalsB - Decimals of token B
 * @returns Price as Decimal
 */
export function sqrtPriceX64ToPrice(
  sqrtPriceX64: BN | string,
  decimalsA: number,
  decimalsB: number
): Decimal {
  const sqrtPriceBN = typeof sqrtPriceX64 === "string" ? new BN(sqrtPriceX64) : sqrtPriceX64;
  
  // Divide by 2^64 to get sqrtPrice
  const sqrtPrice = new Decimal(sqrtPriceBN.toString()).div(
    new Decimal(2).pow(64)
  );
  
  // Square to get price
  const price = sqrtPrice.pow(2);
  
  // Adjust for decimals
  const decimalAdjustment = new Decimal(10).pow(decimalsB - decimalsA);
  
  return price.mul(decimalAdjustment);
}

/**
 * ClmmTickMath namespace for compatibility with existing code
 */
export const ClmmTickMath = {
  tickIndexToSqrtPriceX64,
  sqrtPriceX64ToTickIndex,
  sqrtPriceX64ToPrice,
};
