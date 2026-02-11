import { ClmmTickMath } from "./tickMath";
import { Pool } from "../entities/pool/Pool";
import { Position } from "../entities/position/Position";
import BN from "bn.js";

export const closestActiveRange = (pool: Pool, multiplier = 1) => {
  const halfRange = (multiplier * pool.tickSpacing) / 2;
  const candidateTickLower =
    Math.round((pool.tickCurrent - halfRange) / pool.tickSpacing) *
    pool.tickSpacing;

  let lowerTick = candidateTickLower;
  let currentSqrtPriceX64 = new BN(pool.sqrtPriceX64);
  if (
    currentSqrtPriceX64.lt(
      ClmmTickMath.tickIndexToSqrtPriceX64(pool.tickCurrent)
    )
  ) {
    if (lowerTick === pool.tickCurrent) {
      lowerTick -= pool.tickSpacing;
    }
  }

  return [lowerTick, lowerTick + multiplier * pool.tickSpacing];
};

export const isOutOfRange = (
  position: Position,
  multiplier: number
): boolean => {
  const activeTicks = closestActiveRange(position.pool, multiplier);

  // Position is considered out of range if its tick boundaries don't match the active range
  return (
    position.tickLower !== activeTicks[0] ||
    position.tickUpper !== activeTicks[1]
  );
};
