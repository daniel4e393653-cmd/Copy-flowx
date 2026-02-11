import BN from "bn.js";
import { Position } from "./Position";
import { Pool } from "../pool/Pool";
import { Coin, Protocol } from "../../utils/sdkTypes";

describe("Position", () => {
  // Create a mock pool for testing
  const createMockPool = (): Pool => {
    return new Pool({
      objectId: "0xtest_pool",
      coins: [
        new Coin("0x2::sui::SUI", 9, "SUI"),
        new Coin("0x5d4b::coin::COIN", 6, "USDC"),
      ],
      poolRewards: [],
      reserves: ["1000000000", "1000000000"],
      fee: 3000, // 0.3%
      sqrtPriceX64: "18446744073709551616", // Price at tick 0
      tickCurrent: 0,
      liquidity: "1000000000",
      protocol: Protocol.CETUS,
      feeGrowthGlobalX: "0",
      feeGrowthGlobalY: "0",
      tickSpacing: 60,
    });
  };

  describe("constructor", () => {
    it("should create a position with all properties", () => {
      const pool = createMockPool();
      const position = new Position({
        objectId: "0xtest_position",
        owner: "0xtest_owner",
        pool,
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: "1000000",
        coinsOwedX: "100",
        coinsOwedY: "200",
        feeGrowthInsideXLast: "1000",
        feeGrowthInsideYLast: "2000",
        rewardInfos: [],
      });

      expect(position.id).toBe("0xtest_position");
      expect(position.owner).toBe("0xtest_owner");
      expect(position.pool).toBe(pool);
      expect(position.tickLower).toBe(-1000);
      expect(position.tickUpper).toBe(1000);
      expect(position.liquidity).toBe("1000000");
      expect(position.coinsOwedX).toBe("100");
      expect(position.coinsOwedY).toBe("200");
    });

    it("should handle default values for optional parameters", () => {
      const pool = createMockPool();
      const position = new Position({
        objectId: "0xtest_position",
        owner: "0xtest_owner",
        pool,
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: "1000000",
      });

      expect(position.coinsOwedX).toBe("0");
      expect(position.coinsOwedY).toBe("0");
      expect(position.feeGrowthInsideXLast).toBe("0");
      expect(position.feeGrowthInsideYLast).toBe("0");
      expect(position.rewardInfos).toEqual([]);
    });
  });

  describe("fromAmounts", () => {
    it("should create position with proper liquidity calculation", () => {
      const pool = createMockPool();
      const amountX = new BN(1000000);
      const amountY = new BN(1000000);

      const position = Position.fromAmounts({
        owner: "0xtest_owner",
        pool,
        tickLower: -1000,
        tickUpper: 1000,
        amountX,
        amountY,
      });

      expect(position.owner).toBe("0xtest_owner");
      expect(position.pool).toBe(pool);
      expect(position.tickLower).toBe(-1000);
      expect(position.tickUpper).toBe(1000);
      expect(new BN(position.liquidity).gt(new BN(0))).toBe(true);
      // Liquidity should not just be sum of amounts (which was the old simplified approach)
      expect(position.liquidity).not.toBe(amountX.add(amountY).toString());
    });

    it("should calculate different liquidity for different tick ranges", () => {
      const pool = createMockPool();
      const amountX = new BN(1000000);
      const amountY = new BN(1000000);

      const position1 = Position.fromAmounts({
        owner: "0xtest_owner",
        pool,
        tickLower: -500,
        tickUpper: 500,
        amountX,
        amountY,
      });

      const position2 = Position.fromAmounts({
        owner: "0xtest_owner",
        pool,
        tickLower: -2000,
        tickUpper: 2000,
        amountX,
        amountY,
      });

      // Wider range should result in higher liquidity for same amounts
      expect(new BN(position2.liquidity).gt(new BN(position1.liquidity))).toBe(true);
    });
  });

  describe("amountX and amountY", () => {
    it("should return token amounts with proper structure", () => {
      const pool = createMockPool();
      const position = new Position({
        objectId: "0xtest_position",
        owner: "0xtest_owner",
        pool,
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: "1000000",
      });

      const amountX = position.amountX;
      const amountY = position.amountY;

      expect(amountX.coin).toBe(pool.coinX);
      expect(amountY.coin).toBe(pool.coinY);
      expect(typeof amountX.toExact).toBe("function");
      expect(typeof amountY.toExact).toBe("function");
      expect(amountX.toExact({})).toBeTruthy();
      expect(amountY.toExact({})).toBeTruthy();
    });

    it("should calculate amounts based on current pool price", () => {
      const pool = createMockPool();
      const position = new Position({
        objectId: "0xtest_position",
        owner: "0xtest_owner",
        pool,
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: "1000000",
      });

      const amountXStr = position.amountX.toExact({});
      const amountYStr = position.amountY.toExact({});

      // Both should be positive since price is in range
      expect(new BN(amountXStr).gt(new BN(0))).toBe(true);
      expect(new BN(amountYStr).gt(new BN(0))).toBe(true);
    });
  });

  describe("mintAmounts", () => {
    it("should return BN amounts", () => {
      const pool = createMockPool();
      const position = new Position({
        objectId: "0xtest_position",
        owner: "0xtest_owner",
        pool,
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: "1000000",
      });

      const { amountX, amountY } = position.mintAmounts;

      expect(amountX).toBeInstanceOf(BN);
      expect(amountY).toBeInstanceOf(BN);
      expect(amountX.gt(new BN(0))).toBe(true);
      expect(amountY.gt(new BN(0))).toBe(true);
    });
  });

  describe("getFees", () => {
    it("should return fees including coins owed", async () => {
      const pool = createMockPool();
      const position = new Position({
        objectId: "0xtest_position",
        owner: "0xtest_owner",
        pool,
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: "1000000",
        coinsOwedX: "100",
        coinsOwedY: "200",
      });

      const fees = await position.getFees();

      // Should at least include the coins owed
      expect(fees.amountX.gte(new BN(100))).toBe(true);
      expect(fees.amountY.gte(new BN(200))).toBe(true);
    });

    it("should calculate accrued fees from fee growth", async () => {
      const pool = new Pool({
        objectId: "0xtest_pool",
        coins: [
          new Coin("0x2::sui::SUI", 9, "SUI"),
          new Coin("0x5d4b::coin::COIN", 6, "USDC"),
        ],
        poolRewards: [],
        reserves: ["1000000000", "1000000000"],
        fee: 3000,
        sqrtPriceX64: "18446744073709551616",
        tickCurrent: 0,
        liquidity: "1000000000",
        protocol: Protocol.CETUS,
        feeGrowthGlobalX: "1000000000000000000",
        feeGrowthGlobalY: "2000000000000000000",
        tickSpacing: 60,
      });

      const position = new Position({
        objectId: "0xtest_position",
        owner: "0xtest_owner",
        pool,
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: "1000000",
        coinsOwedX: "0",
        coinsOwedY: "0",
        feeGrowthInsideXLast: "0",
        feeGrowthInsideYLast: "0",
      });

      const fees = await position.getFees();

      // Should have some fees from the fee growth
      expect(fees.amountX.gt(new BN(0))).toBe(true);
      expect(fees.amountY.gt(new BN(0))).toBe(true);
    });
  });

  describe("getRewards", () => {
    it("should return empty array when no rewards", async () => {
      const pool = createMockPool();
      const position = new Position({
        objectId: "0xtest_position",
        owner: "0xtest_owner",
        pool,
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: "1000000",
      });

      const rewards = await position.getRewards();
      expect(rewards).toEqual([]);
    });

    it("should return reward amounts from reward infos", async () => {
      const pool = createMockPool();
      const position = new Position({
        objectId: "0xtest_position",
        owner: "0xtest_owner",
        pool,
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: "1000000",
        rewardInfos: [
          { coinsOwedReward: "1000", rewardGrowthInsideLast: "0" },
          { coinsOwedReward: "2000", rewardGrowthInsideLast: "0" },
        ],
      });

      const rewards = await position.getRewards();
      expect(rewards.length).toBe(2);
      expect(rewards[0].toString()).toBe("1000");
      expect(rewards[1].toString()).toBe("2000");
    });
  });
});
