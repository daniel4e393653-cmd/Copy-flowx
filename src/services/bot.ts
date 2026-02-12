import { BotConfig } from '../types';
import { logger } from '../utils/logger';
import { SuiClientService } from './suiClient';
import { CetusService } from './cetusService';
import { PositionMonitor } from './positionMonitor';
import { RebalanceService } from './rebalanceService';

export class RebalancingBot {
  private config: BotConfig;
  private suiClient: SuiClientService;
  private cetusService: CetusService;
  private positionMonitor: PositionMonitor;
  private rebalanceService: RebalanceService;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  constructor(config: BotConfig) {
    this.config = config;
    this.suiClient = new SuiClientService(config);
    this.cetusService = new CetusService(this.suiClient, config);
    this.positionMonitor = new PositionMonitor(this.cetusService, config);
    this.rebalanceService = new RebalanceService(
      this.suiClient,
      this.cetusService,
      config
    );
  }
  
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }
    
    this.isRunning = true;
    logger.info('Starting rebalancing bot...');
    logger.info(`Check interval: ${this.config.checkIntervalMs}ms`);
    logger.info(`Rebalance threshold: ${this.config.rebalanceThresholdPercent}%`);
    logger.info(`Range width: ${this.config.rangeWidthPercent}%`);
    
    await this.checkAndRebalance();
    
    this.intervalId = setInterval(async () => {
      await this.checkAndRebalance();
    }, this.config.checkIntervalMs);
    
    logger.info('Bot started successfully');
  }
  
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Bot is not running');
      return;
    }
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    logger.info('Bot stopped');
  }
  
  private async checkAndRebalance(): Promise<void> {
    try {
      logger.info('=== Checking position ===');
      
      const decision = await this.positionMonitor.checkRebalanceNeeded();
      
      if (!decision.shouldRebalance) {
        logger.info(`No action needed: ${decision.reason}`);
        return;
      }
      
      logger.warn(`Rebalance triggered: ${decision.reason}`);
      
      const { pool, position } = await this.positionMonitor.getCurrentState();
      
      await this.rebalanceService.rebalance(pool, position);
      
      logger.info('=== Rebalance completed successfully ===');
    } catch (error) {
      logger.error('Error during check and rebalance', error);
    }
  }
}
