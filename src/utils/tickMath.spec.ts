import BN from "bn.js";
import {
  tickIndexToSqrtPriceX64,
  sqrtPriceX64ToTickIndex,
  getLiquidityFromAmounts,
  getAmountsFromLiquidity,
  getAmountAFromLiquidity,
  getAmountBFromLiquidity,
  getLiquidityFromAmountA,
  getLiquidityFromAmountB,
} from "./tickMath";

describe("tickMath", () => {
  describe("tickIndexToSqrtPriceX64", () => {
    it("should convert tick 0 to correct sqrtPriceX64", () => {
      const sqrtPriceX64 = tickIndexToSqrtPriceX64(0);
      // At tick 0, price = 1, sqrt(1) = 1, so sqrtPriceX64 = 1 * 2^64
      const expectedQ64 = new BN(2).pow(new BN(64));
      expect(sqrtPriceX64.toString()).toBe(expectedQ64.toString());
    });

    it("should convert positive tick to sqrtPriceX64", () => {
      const sqrtPriceX64 = tickIndexToSqrtPriceX64(1000);
      expect(sqrtPriceX64.gt(new BN(0))).toBe(true);
    });

    it("should convert negative tick to sqrtPriceX64", () => {
      const sqrtPriceX64 = tickIndexToSqrtPriceX64(-1000);
      expect(sqrtPriceX64.gt(new BN(0))).toBe(true);
    });

    it("should throw error for tick out of bounds", () => {
      expect(() => tickIndexToSqrtPriceX64(500000)).toThrow();
      expect(() => tickIndexToSqrtPriceX64(-500000)).toThrow();
    });
  });

  describe("sqrtPriceX64ToTickIndex", () => {
    it("should convert sqrtPriceX64 back to tick approximately", () => {
      const originalTick = 1000;
      const sqrtPriceX64 = tickIndexToSqrtPriceX64(originalTick);
      const convertedTick = sqrtPriceX64ToTickIndex(sqrtPriceX64);
      // Should be approximately equal (within 1 due to rounding)
      expect(Math.abs(convertedTick - originalTick)).toBeLessThanOrEqual(1);
    });

    it("should handle tick 0 round trip", () => {
      const sqrtPriceX64 = tickIndexToSqrtPriceX64(0);
      const tick = sqrtPriceX64ToTickIndex(sqrtPriceX64);
      expect(Math.abs(tick)).toBeLessThanOrEqual(1);
    });
  });

  describe("getLiquidityFromAmounts", () => {
    it("should calculate liquidity when price is in range", () => {
      const sqrtPriceLower = tickIndexToSqrtPriceX64(-1000);
      const sqrtPriceUpper = tickIndexToSqrtPriceX64(1000);
      const sqrtPriceCurrent = tickIndexToSqrtPriceX64(0);
      const amountA = new BN(1000000);
      const amountB = new BN(1000000);

      const liquidity = getLiquidityFromAmounts(
        sqrtPriceCurrent,
        sqrtPriceLower,
        sqrtPriceUpper,
        amountA,
        amountB
      );

      expect(liquidity.gt(new BN(0))).toBe(true);
    });

    it("should use only amountA when price is below range", () => {
      const sqrtPriceLower = tickIndexToSqrtPriceX64(1000);
      const sqrtPriceUpper = tickIndexToSqrtPriceX64(2000);
      const sqrtPriceCurrent = tickIndexToSqrtPriceX64(0); // Below range
      const amountA = new BN(1000000);
      const amountB = new BN(0);

      const liquidity = getLiquidityFromAmounts(
        sqrtPriceCurrent,
        sqrtPriceLower,
        sqrtPriceUpper,
        amountA,
        amountB
      );

      expect(liquidity.gt(new BN(0))).toBe(true);
    });

    it("should use only amountB when price is above range", () => {
      const sqrtPriceLower = tickIndexToSqrtPriceX64(-2000);
      const sqrtPriceUpper = tickIndexToSqrtPriceX64(-1000);
      const sqrtPriceCurrent = tickIndexToSqrtPriceX64(0); // Above range
      const amountA = new BN(0);
      const amountB = new BN(1000000);

      const liquidity = getLiquidityFromAmounts(
        sqrtPriceCurrent,
        sqrtPriceLower,
        sqrtPriceUpper,
        amountA,
        amountB
      );

      expect(liquidity.gt(new BN(0))).toBe(true);
    });
  });

  describe("getAmountsFromLiquidity", () => {
    it("should return both amounts when price is in range", () => {
      const sqrtPriceLower = tickIndexToSqrtPriceX64(-1000);
      const sqrtPriceUpper = tickIndexToSqrtPriceX64(1000);
      const sqrtPriceCurrent = tickIndexToSqrtPriceX64(0);
      const liquidity = new BN(1000000);

      const { amountA, amountB } = getAmountsFromLiquidity(
        sqrtPriceCurrent,
        sqrtPriceLower,
        sqrtPriceUpper,
        liquidity,
        false
      );

      expect(amountA.gt(new BN(0))).toBe(true);
      expect(amountB.gt(new BN(0))).toBe(true);
    });

    it("should return only amountA when price is below range", () => {
      const sqrtPriceLower = tickIndexToSqrtPriceX64(1000);
      const sqrtPriceUpper = tickIndexToSqrtPriceX64(2000);
      const sqrtPriceCurrent = tickIndexToSqrtPriceX64(0);
      const liquidity = new BN(1000000);

      const { amountA, amountB } = getAmountsFromLiquidity(
        sqrtPriceCurrent,
        sqrtPriceLower,
        sqrtPriceUpper,
        liquidity,
        false
      );

      expect(amountA.gt(new BN(0))).toBe(true);
      expect(amountB.eq(new BN(0))).toBe(true);
    });

    it("should return only amountB when price is above range", () => {
      const sqrtPriceLower = tickIndexToSqrtPriceX64(-2000);
      const sqrtPriceUpper = tickIndexToSqrtPriceX64(-1000);
      const sqrtPriceCurrent = tickIndexToSqrtPriceX64(0);
      const liquidity = new BN(1000000);

      const { amountA, amountB } = getAmountsFromLiquidity(
        sqrtPriceCurrent,
        sqrtPriceLower,
        sqrtPriceUpper,
        liquidity,
        false
      );

      expect(amountA.eq(new BN(0))).toBe(true);
      expect(amountB.gt(new BN(0))).toBe(true);
    });
  });

  describe("round trip conversions", () => {
    it("should convert amounts to liquidity and back approximately", () => {
      const sqrtPriceLower = tickIndexToSqrtPriceX64(-1000);
      const sqrtPriceUpper = tickIndexToSqrtPriceX64(1000);
      const sqrtPriceCurrent = tickIndexToSqrtPriceX64(0);
      const originalAmountA = new BN(1000000);
      const originalAmountB = new BN(1000000);

      // Convert amounts to liquidity
      const liquidity = getLiquidityFromAmounts(
        sqrtPriceCurrent,
        sqrtPriceLower,
        sqrtPriceUpper,
        originalAmountA,
        originalAmountB
      );

      // Convert liquidity back to amounts
      const { amountA, amountB } = getAmountsFromLiquidity(
        sqrtPriceCurrent,
        sqrtPriceLower,
        sqrtPriceUpper,
        liquidity,
        false
      );

      // Amounts should be approximately equal (within small tolerance due to rounding)
      const tolerancePercent = 0.01; // 1% tolerance
      const diffA = amountA.sub(originalAmountA).abs();
      const diffB = amountB.sub(originalAmountB).abs();
      
      expect(diffA.muln(100).div(originalAmountA).toNumber()).toBeLessThan(tolerancePercent * 100);
      expect(diffB.muln(100).div(originalAmountB).toNumber()).toBeLessThan(tolerancePercent * 100);
    });
  });

  describe("getAmountAFromLiquidity", () => {
    it("should calculate amount A from liquidity", () => {
      const sqrtPriceA = tickIndexToSqrtPriceX64(-1000);
      const sqrtPriceB = tickIndexToSqrtPriceX64(1000);
      const liquidity = new BN(1000000);

      const amountA = getAmountAFromLiquidity(sqrtPriceA, sqrtPriceB, liquidity, false);
      expect(amountA.gt(new BN(0))).toBe(true);
    });

    it("should handle swapped prices", () => {
      const sqrtPriceA = tickIndexToSqrtPriceX64(1000);
      const sqrtPriceB = tickIndexToSqrtPriceX64(-1000);
      const liquidity = new BN(1000000);

      const amountA = getAmountAFromLiquidity(sqrtPriceA, sqrtPriceB, liquidity, false);
      expect(amountA.gt(new BN(0))).toBe(true);
    });
  });

  describe("getAmountBFromLiquidity", () => {
    it("should calculate amount B from liquidity", () => {
      const sqrtPriceA = tickIndexToSqrtPriceX64(-1000);
      const sqrtPriceB = tickIndexToSqrtPriceX64(1000);
      const liquidity = new BN(1000000);

      const amountB = getAmountBFromLiquidity(sqrtPriceA, sqrtPriceB, liquidity, false);
      expect(amountB.gt(new BN(0))).toBe(true);
    });
  });

  describe("getLiquidityFromAmountA", () => {
    it("should calculate liquidity from amount A", () => {
      const sqrtPriceA = tickIndexToSqrtPriceX64(-1000);
      const sqrtPriceB = tickIndexToSqrtPriceX64(1000);
      const amountA = new BN(1000000);

      const liquidity = getLiquidityFromAmountA(sqrtPriceA, sqrtPriceB, amountA);
      expect(liquidity.gt(new BN(0))).toBe(true);
    });
  });

  describe("getLiquidityFromAmountB", () => {
    it("should calculate liquidity from amount B", () => {
      const sqrtPriceA = tickIndexToSqrtPriceX64(-1000);
      const sqrtPriceB = tickIndexToSqrtPriceX64(1000);
      const amountB = new BN(1000000);

      const liquidity = getLiquidityFromAmountB(sqrtPriceA, sqrtPriceB, amountB);
      expect(liquidity.gt(new BN(0))).toBe(true);
    });
  });
});
