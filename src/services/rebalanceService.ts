import { Transaction } from '@mysten/sui/transactions';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';
import { SuiClientService } from './suiClient';
import { CetusService } from './cetusService';
import { BotConfig, Pool, Position } from '../types';
import { logger } from '../utils/logger';
import {
  calculateTickRange,
  tickToSqrtPrice,
  getAmountAFromLiquidity,
  getAmountBFromLiquidity,
} from '../utils/tickMath';

export class RebalanceService {
  private suiClient: SuiClientService;
  private cetusService: CetusService;
  private config: BotConfig;
  
  constructor(
    suiClient: SuiClientService,
    cetusService: CetusService,
    config: BotConfig
  ) {
    this.suiClient = suiClient;
    this.cetusService = cetusService;
    this.config = config;
  }
  
  async rebalance(pool: Pool, position: Position): Promise<void> {
    logger.info('=== Starting Atomic PTB Rebalance ===');
    
    // Pre-execution validation
    await this.suiClient.checkGasPrice();
    
    // Calculate new range with validated tick spacing
    const newRange = calculateTickRange(
      pool.currentTick,
      this.config.rangeWidthPercent,
      pool.tickSpacing
    );
    
    logger.info(`Current tick: ${pool.currentTick}`);
    logger.info(`Old range: [${position.tickLower}, ${position.tickUpper}]`);
    logger.info(`New range: [${newRange.tickLower}, ${newRange.tickUpper}]`);
    
    // Validate tick spacing alignment
    if (newRange.tickLower % pool.tickSpacing !== 0 || newRange.tickUpper % pool.tickSpacing !== 0) {
      throw new Error('New range ticks not aligned to tick spacing');
    }
    
    // Calculate expected amounts with slippage protection
    const expectedAmounts = this.calculateExpectedAmounts(pool, position);
    const slippageFactor = (100 - this.config.maxSlippagePercent) / 100;
    const minAmountA = BigInt(Math.floor(Number(expectedAmounts.amountA) * slippageFactor));
    const minAmountB = BigInt(Math.floor(Number(expectedAmounts.amountB) * slippageFactor));
    
    logger.info(`Expected amounts: A=${expectedAmounts.amountA}, B=${expectedAmounts.amountB}`);
    logger.info(`Min amounts (${this.config.maxSlippagePercent}% slippage): A=${minAmountA}, B=${minAmountB}`);
    
    // Build single atomic PTB
    const ptb = await this.buildRebalancePTB(pool, position, newRange, minAmountA, minAmountB);
    
    // Execute atomically (single execution)
    logger.info('Executing atomic PTB...');
    const result = await this.suiClient.executeTransactionWithoutSimulation(ptb);
    
    logger.info(`Rebalance successful! Digest: ${result.digest}`);
    logger.info('=== Atomic PTB Rebalance Complete ===');
  }
  
  private calculateExpectedAmounts(pool: Pool, position: Position): { amountA: bigint; amountB: bigint } {
    const sqrtPriceCurrent = BigInt(pool.currentSqrtPrice);
    const sqrtPriceLower = tickToSqrtPrice(position.tickLower);
    const sqrtPriceUpper = tickToSqrtPrice(position.tickUpper);
    const liquidity = BigInt(position.liquidity);
    
    // Determine which tokens we'll get based on current price relative to range
    let amountA: bigint;
    let amountB: bigint;
    
    if (sqrtPriceCurrent <= sqrtPriceLower) {
      // Current price below range - all token A
      amountA = getAmountAFromLiquidity(sqrtPriceLower, sqrtPriceUpper, liquidity);
      amountB = BigInt(0);
    } else if (sqrtPriceCurrent >= sqrtPriceUpper) {
      // Current price above range - all token B
      amountA = BigInt(0);
      amountB = getAmountBFromLiquidity(sqrtPriceLower, sqrtPriceUpper, liquidity);
    } else {
      // Current price in range - both tokens
      amountA = getAmountAFromLiquidity(sqrtPriceCurrent, sqrtPriceUpper, liquidity);
      amountB = getAmountBFromLiquidity(sqrtPriceLower, sqrtPriceCurrent, liquidity);
    }
    
    return { amountA, amountB };
  }
  
  private async buildRebalancePTB(
    pool: Pool,
    position: Position,
    newRange: { tickLower: number; tickUpper: number },
    minAmountA: bigint,
    minAmountB: bigint
  ): Promise<Transaction> {
    const ptb = new Transaction();
    const sdk = this.cetusService.getSDK();
    const packageId = sdk.sdkOptions.cetus_config.package_id;
    const globalConfigId = sdk.sdkOptions.cetus_config.config!.global_config_id;
    
    logger.info('Building atomic PTB with all operations...');
    
    // Step 1: Remove liquidity from old position
    logger.info('Step 1: Remove liquidity');
    const [removedCoinA, removedCoinB] = ptb.moveCall({
      target: `${packageId}::pool_script::remove_liquidity`,
      arguments: [
        ptb.object(globalConfigId),
        ptb.object(pool.id),
        ptb.object(position.id),
        ptb.pure.u128(position.liquidity),
        ptb.pure.u64(minAmountA.toString()),
        ptb.pure.u64(minAmountB.toString()),
        ptb.object(SUI_CLOCK_OBJECT_ID),
      ],
      typeArguments: [pool.coinTypeA, pool.coinTypeB],
    });
    
    // Step 2: Collect fees from old position
    logger.info('Step 2: Collect fees');
    const [feeCoinA, feeCoinB] = ptb.moveCall({
      target: `${packageId}::pool_script::collect_fee`,
      arguments: [
        ptb.object(globalConfigId),
        ptb.object(pool.id),
        ptb.object(position.id),
        ptb.pure.bool(true),
      ],
      typeArguments: [pool.coinTypeA, pool.coinTypeB],
    });
    
    // Step 3: Merge removed liquidity with collected fees
    logger.info('Step 3: Merge coins');
    ptb.mergeCoins(removedCoinA, [feeCoinA]);
    ptb.mergeCoins(removedCoinB, [feeCoinB]);
    
    // Step 4: Close old position (cleanup NFT)
    logger.info('Step 4: Close old position');
    ptb.moveCall({
      target: `${packageId}::pool_script::close_position`,
      arguments: [
        ptb.object(globalConfigId),
        ptb.object(pool.id),
        ptb.object(position.id),
      ],
      typeArguments: [pool.coinTypeA, pool.coinTypeB],
    });
    
    // Step 5: Calculate optimal coin ratio for new range and swap if needed
    logger.info('Step 5: Swap to optimal ratio (if needed)');
    const { coinA: balancedCoinA, coinB: balancedCoinB } = await this.addSwapIfNeeded(
      ptb,
      pool,
      newRange,
      removedCoinA,
      removedCoinB,
      packageId,
      globalConfigId
    );
    
    // Step 6: Open new position with correct tick format
    logger.info('Step 6: Open new position');
    const tickLowerAbs = Math.abs(newRange.tickLower);
    const tickUpperAbs = Math.abs(newRange.tickUpper);
    const isTickLowerNegative = newRange.tickLower < 0;
    const isTickUpperNegative = newRange.tickUpper < 0;
    
    const newPosition = ptb.moveCall({
      target: `${packageId}::pool_script::open_position`,
      arguments: [
        ptb.object(globalConfigId),
        ptb.object(pool.id),
        ptb.pure.u32(tickLowerAbs),
        ptb.pure.bool(isTickLowerNegative),
        ptb.pure.u32(tickUpperAbs),
        ptb.pure.bool(isTickUpperNegative),
        ptb.object(SUI_CLOCK_OBJECT_ID),
      ],
      typeArguments: [pool.coinTypeA, pool.coinTypeB],
    });
    
    // Step 7: Add liquidity to new position
    logger.info('Step 7: Add liquidity to new position');
    
    // Calculate minimum amounts for adding liquidity (with slippage protection)
    const minAddAmountA = minAmountA;
    const minAddAmountB = minAmountB;
    
    ptb.moveCall({
      target: `${packageId}::pool_script::add_liquidity`,
      arguments: [
        ptb.object(globalConfigId),
        ptb.object(pool.id),
        newPosition,
        balancedCoinA,
        balancedCoinB,
        ptb.pure.u64(minAddAmountA.toString()),
        ptb.pure.u64(minAddAmountB.toString()),
        ptb.object(SUI_CLOCK_OBJECT_ID),
      ],
      typeArguments: [pool.coinTypeA, pool.coinTypeB],
    });
    
    // Step 8: Transfer new position NFT to sender
    logger.info('Step 8: Transfer new position to sender');
    ptb.transferObjects([newPosition], ptb.pure.address(this.suiClient.getAddress()));
    
    return ptb;
  }
  
  private async addSwapIfNeeded(
    ptb: Transaction,
    pool: Pool,
    newRange: { tickLower: number; tickUpper: number },
    coinA: any,
    coinB: any,
    packageId: string,
    globalConfigId: string
  ): Promise<{ coinA: any; coinB: any }> {
    // Calculate optimal ratio for new range
    const sqrtPriceCurrent = BigInt(pool.currentSqrtPrice);
    const sqrtPriceLower = tickToSqrtPrice(newRange.tickLower);
    const sqrtPriceUpper = tickToSqrtPrice(newRange.tickUpper);
    
    // Determine if we need to swap
    // For a position, the optimal ratio depends on where current price is relative to the range
    
    // For simplicity, we'll check if current price is within new range
    // If current price is in the new range, we need both tokens
    // If below, we need mostly token A
    // If above, we need mostly token B
    
    if (sqrtPriceCurrent < sqrtPriceLower) {
      // Price below range - need token A
      // If we have token B, swap some B to A
      logger.info('Price below new range - swapping B to A if needed');
      
      const swappedCoinA = ptb.moveCall({
        target: `${packageId}::pool_script::swap_b2a`,
        arguments: [
          ptb.object(globalConfigId),
          ptb.object(pool.id),
          coinB,
          ptb.pure.u64('0'), // min_amount_out (we'll accept any amount for simplicity)
          ptb.object(SUI_CLOCK_OBJECT_ID),
        ],
        typeArguments: [pool.coinTypeA, pool.coinTypeB],
      });
      
      ptb.mergeCoins(coinA, [swappedCoinA]);
      
      return { coinA, coinB };
      
    } else if (sqrtPriceCurrent > sqrtPriceUpper) {
      // Price above range - need token B
      // If we have token A, swap some A to B
      logger.info('Price above new range - swapping A to B if needed');
      
      const swappedCoinB = ptb.moveCall({
        target: `${packageId}::pool_script::swap_a2b`,
        arguments: [
          ptb.object(globalConfigId),
          ptb.object(pool.id),
          coinA,
          ptb.pure.u64('0'), // min_amount_out
          ptb.object(SUI_CLOCK_OBJECT_ID),
        ],
        typeArguments: [pool.coinTypeA, pool.coinTypeB],
      });
      
      ptb.mergeCoins(coinB, [swappedCoinB]);
      
      return { coinA, coinB };
      
    } else {
      // Price in range - need both tokens in proportion
      // For now, we'll use the coins as-is without swapping
      // In production, we'd calculate exact amounts needed and swap accordingly
      logger.info('Price in new range - using coins as-is');
      return { coinA, coinB };
    }
  }
}
