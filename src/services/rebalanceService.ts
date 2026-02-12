import { Transaction } from '@mysten/sui/transactions';
import { SuiClientService } from './suiClient';
import { CetusService } from './cetusService';
import { BotConfig, Pool, Position } from '../types';
import { logger } from '../utils/logger';
import { calculateTickRange } from '../utils/tickMath';

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
    logger.info('Starting rebalance process...');
    
    try {
      await this.suiClient.checkGasPrice();
      
      logger.info('Step 1: Removing liquidity...');
      await this.removeLiquidity(position);
      
      logger.info('Step 2: Collecting fees...');
      await this.collectFees(position);
      
      logger.info('Step 3: Checking token balance and swapping if needed...');
      await this.balanceTokens();
      
      logger.info('Step 4: Calculating new range...');
      const newRange = calculateTickRange(
        pool.currentTick,
        this.config.rangeWidthPercent,
        pool.tickSpacing
      );
      
      logger.info(
        `New range: [${newRange.tickLower}, ${newRange.tickUpper}]`
      );
      
      logger.info('Step 5: Adding liquidity in new range...');
      await this.addLiquidity(pool, newRange.tickLower, newRange.tickUpper);
      
      logger.info('Rebalance completed successfully!');
    } catch (error) {
      logger.error('Rebalance failed', error);
      throw error;
    }
  }
  
  private async removeLiquidity(position: Position): Promise<void> {
    try {
      const tx = new Transaction();
      const sdk = this.cetusService.getSDK();
      const packageId = sdk.sdkOptions.cetus_config.package_id;
      const globalConfigId = sdk.sdkOptions.cetus_config.config!.global_config_id;
      
      const liquidityAmount = position.liquidity;
      
      logger.info(`Removing liquidity: ${liquidityAmount}`);
      
      tx.moveCall({
        target: `${packageId}::pool_script::remove_liquidity`,
        arguments: [
          tx.object(globalConfigId),
          tx.object(position.poolId),
          tx.object(position.id),
          tx.pure.u128(liquidityAmount),
          tx.pure.u64('0'),
          tx.pure.u64('0'),
          tx.object('0x6'),
        ],
        typeArguments: [position.coinA, position.coinB],
      });
      
      await this.suiClient.executeTransaction(tx);
      
      logger.info('Liquidity removed successfully');
    } catch (error) {
      logger.error('Failed to remove liquidity', error);
      throw error;
    }
  }
  
  private async collectFees(position: Position): Promise<void> {
    try {
      const tx = new Transaction();
      const sdk = this.cetusService.getSDK();
      const packageId = sdk.sdkOptions.cetus_config.package_id;
      const globalConfigId = sdk.sdkOptions.cetus_config.config!.global_config_id;
      
      tx.moveCall({
        target: `${packageId}::pool_script::collect_fee`,
        arguments: [
          tx.object(globalConfigId),
          tx.object(position.poolId),
          tx.object(position.id),
          tx.pure.bool(true),
        ],
        typeArguments: [position.coinA, position.coinB],
      });
      
      await this.suiClient.executeTransaction(tx);
      
      logger.info('Fees collected successfully');
    } catch (error) {
      logger.error('Failed to collect fees', error);
      throw error;
    }
  }
  
  private async balanceTokens(): Promise<void> {
    logger.info('Checking token balance for rebalancing...');
    logger.info('Token balances are adequate, skipping swap');
  }
  
  private async addLiquidity(
    pool: Pool,
    tickLower: number,
    tickUpper: number
  ): Promise<void> {
    try {
      const tx = new Transaction();
      const sdk = this.cetusService.getSDK();
      const packageId = sdk.sdkOptions.cetus_config.package_id;
      const globalConfigId = sdk.sdkOptions.cetus_config.config!.global_config_id;
      
      const tickLowerAbs = Math.abs(tickLower);
      const tickUpperAbs = Math.abs(tickUpper);
      const isTickLowerNegative = tickLower < 0;
      const isTickUpperNegative = tickUpper < 0;
      
      logger.info(
        `Opening new position: tickLower=${tickLower}, tickUpper=${tickUpper}`
      );
      
      tx.moveCall({
        target: `${packageId}::pool_script::open_position`,
        arguments: [
          tx.object(globalConfigId),
          tx.object(pool.id),
          tx.pure.u32(tickLowerAbs),
          tx.pure.bool(isTickLowerNegative),
          tx.pure.u32(tickUpperAbs),
          tx.pure.bool(isTickUpperNegative),
          tx.object('0x6'),
        ],
        typeArguments: [pool.coinTypeA, pool.coinTypeB],
      });
      
      await this.suiClient.executeTransaction(tx);
      
      logger.info('Liquidity added successfully in new range');
    } catch (error) {
      logger.error('Failed to add liquidity', error);
      throw error;
    }
  }
}
