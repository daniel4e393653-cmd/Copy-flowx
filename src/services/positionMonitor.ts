import { CetusService } from './cetusService';
import { BotConfig, Pool, Position, RebalanceDecision } from '../types';
import { logger } from '../utils/logger';
import {
  isTickInRange,
  calculatePriceDeviation,
} from '../utils/tickMath';

export class PositionMonitor {
  private cetusService: CetusService;
  private config: BotConfig;
  
  constructor(cetusService: CetusService, config: BotConfig) {
    this.cetusService = cetusService;
    this.config = config;
  }
  
  async checkRebalanceNeeded(): Promise<RebalanceDecision> {
    try {
      const [pool, position] = await Promise.all([
        this.cetusService.getPool(),
        this.cetusService.getPosition(),
      ]);
      
      logger.info(`Current tick: ${pool.currentTick}`);
      logger.info(`Position range: [${position.tickLower}, ${position.tickUpper}]`);
      
      const inRange = isTickInRange(
        pool.currentTick,
        position.tickLower,
        position.tickUpper
      );
      
      if (inRange) {
        logger.info('Position is in range, no rebalance needed');
        return {
          shouldRebalance: false,
          reason: 'Position is in range',
          currentTick: pool.currentTick,
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
          priceDeviation: 0,
        };
      }
      
      const deviation = calculatePriceDeviation(
        pool.currentTick,
        position.tickLower,
        position.tickUpper
      );
      
      logger.info(`Price deviation: ${deviation.toFixed(2)}%`);
      
      if (Math.abs(deviation) < this.config.rebalanceThresholdPercent) {
        logger.info(
          `Deviation ${deviation.toFixed(2)}% below threshold ${this.config.rebalanceThresholdPercent}%`
        );
        return {
          shouldRebalance: false,
          reason: `Deviation ${deviation.toFixed(2)}% below threshold`,
          currentTick: pool.currentTick,
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
          priceDeviation: deviation,
        };
      }
      
      logger.warn(`Rebalance needed! Deviation: ${deviation.toFixed(2)}%`);
      
      return {
        shouldRebalance: true,
        reason: `Price moved ${deviation.toFixed(2)}% outside range`,
        currentTick: pool.currentTick,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        priceDeviation: deviation,
      };
    } catch (error) {
      logger.error('Failed to check rebalance', error);
      throw error;
    }
  }
  
  async getCurrentState(): Promise<{ pool: Pool; position: Position }> {
    const [pool, position] = await Promise.all([
      this.cetusService.getPool(),
      this.cetusService.getPosition(),
    ]);
    
    return { pool, position };
  }
}
