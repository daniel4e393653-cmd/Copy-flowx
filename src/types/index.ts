export interface BotConfig {
  privateKey: string;
  rpcUrl: string;
  poolId: string;
  positionId: string;
  rebalanceThresholdPercent: number;
  rangeWidthPercent: number;
  checkIntervalMs: number;
  maxSlippagePercent: number;
  maxGasPrice: number;
  minRetryDelayMs: number;
  maxRetryDelayMs: number;
  maxRetries: number;
}

export interface Position {
  id: string;
  poolId: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  coinA: string;
  coinB: string;
}

export interface Pool {
  id: string;
  coinTypeA: string;
  coinTypeB: string;
  currentSqrtPrice: string;
  currentTick: number;
  tickSpacing: number;
  feeRate: number;
}

export interface RebalanceDecision {
  shouldRebalance: boolean;
  reason: string;
  currentTick: number;
  tickLower: number;
  tickUpper: number;
  priceDeviation: number;
}

export interface SwapParams {
  coinTypeIn: string;
  coinTypeOut: string;
  amountIn: string;
  minAmountOut: string;
}

export interface TickRange {
  tickLower: number;
  tickUpper: number;
}
