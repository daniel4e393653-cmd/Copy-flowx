import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { BotConfig } from '../types';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { normalizeTypeArguments, isTypeArgError } from '../utils/typeArgNormalizer';

export class SuiClientService {
  private client: SuiClient;
  private keypair: Ed25519Keypair;
  private config: BotConfig;
  
  constructor(config: BotConfig) {
    this.config = config;
    this.client = new SuiClient({ url: config.rpcUrl });
    
    // Validate private key format
    if (!config.privateKey.startsWith('0x') || config.privateKey.length !== 66) {
      throw new Error('Invalid private key format: must be 0x-prefixed 64 hex chars');
    }
    
    this.keypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(config.privateKey.slice(2), 'hex')
    );
    
    logger.info(`Sui client initialized with RPC: ${config.rpcUrl}`);
    logger.info(`Wallet address: ${this.keypair.getPublicKey().toSuiAddress()}`);
  }
  
  getClient(): SuiClient {
    return this.client;
  }
  
  getKeypair(): Ed25519Keypair {
    return this.keypair;
  }
  
  getAddress(): string {
    return this.keypair.getPublicKey().toSuiAddress();
  }
  
  async simulateTransaction(tx: Transaction): Promise<void> {
    try {
      await withRetry(
        async () => {
          // Build transaction for simulation
          const txBytes = await tx.build({ client: this.client });
          
          const result = await this.client.dryRunTransactionBlock({
            transactionBlock: txBytes,
          });
          
          if (result.effects.status.status !== 'success') {
            throw new Error(
              `Transaction simulation failed: ${result.effects.status.error || 'Unknown error'}`
            );
          }
          
          logger.debug('Transaction simulation successful');
        },
        this.config.maxRetries,
        this.config.minRetryDelayMs,
        this.config.maxRetryDelayMs,
        'Transaction simulation'
      );
    } catch (error) {
      logger.error('Transaction simulation failed', error);
      throw error;
    }
  }
  
  async executeTransaction(tx: Transaction): Promise<SuiTransactionBlockResponse> {
    try {
      // First simulate (this builds the transaction)
      await this.simulateTransaction(tx);
      
      // Transaction is now built, cannot execute it
      // This is a fundamental limitation - we cannot both simulate AND execute
      // the same Transaction object
      throw new Error(
        'Cannot execute after simulation: Transaction object can only be built once. ' +
        'Caller must create separate transactions for simulation and execution.'
      );
    } catch (error) {
      logger.error('Transaction execution failed', error);
      throw error;
    }
  }
  
  async executeTransactionWithoutSimulation(tx: Transaction): Promise<SuiTransactionBlockResponse> {
    const maxRetries = 5; // As per requirement: retry up to 5 times
    
    try {
      // Attempt execution with retry logic and type argument auto-correction
      return await this.executeWithTypeArgRetry(tx, maxRetries);
    } catch (error) {
      logger.error('Transaction execution failed after all retries', error);
      throw error;
    }
  }
  
  /**
   * Execute transaction with automatic type argument correction and retry logic
   * Retries up to maxRetries times with exponential backoff
   */
  private async executeWithTypeArgRetry(
    tx: Transaction,
    maxRetries: number
  ): Promise<SuiTransactionBlockResponse> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Clone the transaction data to normalize type arguments
        const txData = tx.getData();
        
        // Normalize all type arguments in moveCall commands
        if (txData.commands) {
          txData.commands.forEach((command: any) => {
            if (command.$kind === 'MoveCall' && command.MoveCall?.typeArguments) {
              const originalTypeArgs = command.MoveCall.typeArguments;
              command.MoveCall.typeArguments = normalizeTypeArguments(originalTypeArgs);
            }
          });
        }
        
        // Execute the transaction
        const result = await this.client.signAndExecuteTransaction({
          transaction: tx,
          signer: this.keypair,
          options: {
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
          },
        });
        
        if (result.effects?.status.status !== 'success') {
          throw new Error(
            `Transaction execution failed: ${result.effects?.status.error || 'Unknown error'}`
          );
        }
        
        logger.info(`Transaction executed successfully: ${result.digest}`);
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        // Check if this is a type argument related error
        const isTypeError = isTypeArgError(lastError);
        
        if (attempt < maxRetries) {
          // Calculate exponential backoff delay
          const baseDelay = this.config.minRetryDelayMs || 1000;
          const maxDelay = this.config.maxRetryDelayMs || 30000;
          const delay = Math.min(
            baseDelay * Math.pow(2, attempt),
            maxDelay
          );
          
          const errorType = isTypeError ? 'Type argument error' : 'Transaction error';
          logger.warn(
            `${errorType} on attempt ${attempt + 1}/${maxRetries + 1}: ${lastError.message}. ` +
            `Retrying with exponential backoff in ${delay}ms...`
          );
          
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          logger.error(`Transaction execution failed after ${maxRetries + 1} attempts`);
        }
      }
    }
    
    throw lastError;
  }
  
  async getGasPrice(): Promise<bigint> {
    try {
      return await withRetry(
        async () => {
          const gasPrice = await this.client.getReferenceGasPrice();
          return BigInt(gasPrice);
        },
        this.config.maxRetries,
        this.config.minRetryDelayMs,
        this.config.maxRetryDelayMs,
        'Get gas price'
      );
    } catch (error) {
      logger.error('Failed to get gas price', error);
      throw error;
    }
  }
  
  async checkGasPrice(): Promise<void> {
    const gasPrice = await this.getGasPrice();
    
    if (gasPrice > BigInt(this.config.maxGasPrice)) {
      throw new Error(
        `Gas price ${gasPrice} exceeds maximum ${this.config.maxGasPrice}`
      );
    }
    
    logger.debug(`Gas price check passed: ${gasPrice}`);
  }
}
