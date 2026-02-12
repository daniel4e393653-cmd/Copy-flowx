# Cetus CLMM Rebalancing Bot

A production-ready Concentrated Liquidity Market Maker (CLMM) rebalancing bot for Cetus Protocol on Sui blockchain.

## Features

### ✅ Production Ready
- **Fully Typed**: No `any` types, strict TypeScript compilation
- **Modern Stack**: @mysten/sui SDK v1.18.0, Cetus SDK v5.4.0
- **Error Handling**: Comprehensive try-catch blocks with proper logging
- **Retry Logic**: Exponential backoff for RPC failures
- **Gas Safety**: Checks gas prices before executing transactions
- **Transaction Simulation**: Dry runs before actual execution

### ✅ Rebalancing Strategy
- **ICT-Style Logic**: Recenters range around current price
- **Configurable Range**: Default 5% width
- **Smart Triggering**: Only rebalances if price moves 2% outside range
- **Complete Workflow**:
  1. Monitor active position
  2. Remove liquidity if out of range
  3. Collect fees and rewards
  4. Swap tokens if needed (balance ratio)
  5. Calculate new optimal tick range
  6. Add liquidity in new range

### ✅ Security
- Private keys from environment variables only
- No hardcoded credentials
- Pool ID and Position ID validation
- Slippage protection on all swaps

## Project Structure

```
src/
├── config/
│   └── index.ts           # Environment variable loading & validation
├── services/
│   ├── bot.ts             # Main bot orchestrator
│   ├── suiClient.ts       # Sui blockchain client with retry logic
│   ├── cetusService.ts    # Cetus SDK integration
│   ├── positionMonitor.ts # Position monitoring & rebalance decisions
│   └── rebalanceService.ts # Rebalance execution logic
├── utils/
│   ├── logger.ts          # Winston logging system
│   ├── retry.ts           # Retry with exponential backoff
│   └── tickMath.ts        # CLMM tick calculations
├── types/
│   └── index.ts           # TypeScript interfaces
└── index.ts               # Entry point
```

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

### Required Variables

```bash
# Sui private key (0x-prefixed, 64 hex chars)
PRIVATE_KEY=0x1234567890abcdef...

# Cetus pool ID to monitor
POOL_ID=0x...

# Position ID to rebalance
POSITION_ID=0x...
```

### Optional Variables

```bash
# Sui RPC URL (default: mainnet)
RPC_URL=https://fullnode.mainnet.sui.io:443

# Rebalance threshold in percent (default: 2.0)
# Only rebalance if price moves this % outside range
REBALANCE_THRESHOLD_PERCENT=2.0

# Range width in percent (default: 5.0)
RANGE_WIDTH_PERCENT=5.0

# Check interval in milliseconds (default: 60000 = 1 minute)
CHECK_INTERVAL_MS=60000

# Maximum slippage in percent (default: 1.0)
MAX_SLIPPAGE_PERCENT=1.0

# Maximum gas price in MIST (default: 1000000000 = 1 SUI)
MAX_GAS_PRICE=1000000000

# Retry configuration
MIN_RETRY_DELAY_MS=1000
MAX_RETRY_DELAY_MS=30000
MAX_RETRIES=3

# Log level (default: info)
# Options: error, warn, info, debug
LOG_LEVEL=info
```

## Usage

### Build

```bash
npm run build
```

### Run

```bash
npm start
```

### Development

Build and run in one command:

```bash
npm run dev
```

## How It Works

### 1. Initialization
- Loads and validates environment variables
- Initializes Sui client with retry logic
- Connects to Cetus SDK
- Sets up winston logging

### 2. Monitoring Loop
Every 60 seconds (configurable):
- Fetches current pool state (price, tick)
- Fetches position state (tick range, liquidity)
- Checks if current tick is within position range

### 3. Rebalance Decision
If price is outside range AND deviation > threshold:
- Calculate price deviation percentage
- Trigger rebalance if deviation >= 2% (default)

### 4. Rebalance Execution
**Step 1: Remove Liquidity**
- Removes all liquidity from current position
- Uses Cetus `pool_script::remove_liquidity`

**Step 2: Collect Fees**
- Collects all accumulated fees
- Uses Cetus `pool_script::collect_fee`

**Step 3: Balance Tokens**
- Checks token A/B ratio
- Swaps if needed to balance for new position

**Step 4: Calculate New Range**
- Centers around current tick
- Applies configured width percentage
- Aligns to tick spacing

**Step 5: Add Liquidity**
- Opens new position in calculated range
- Uses Cetus `pool_script::open_position`
- Converts ticks to absolute values with sign flags

## Tick Math

The bot implements accurate CLMM math:

- **Tick to SqrtPrice**: Uniswap V3 compatible calculation
- **Liquidity Calculations**: Proper Q64 fixed-point arithmetic
- **Tick Alignment**: Respects pool tick spacing
- **Range Calculation**: ICT-style centered around current price

## Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console - Colorized output

## Error Handling

- All RPC calls wrapped with retry logic
- Exponential backoff on failures
- Transaction simulation before execution
- Gas price checks before submission
- Graceful shutdown on SIGINT/SIGTERM

## Safety Features

1. **Transaction Simulation**: All transactions are dry-run before execution
2. **Gas Price Protection**: Refuses to execute if gas price exceeds limit
3. **Slippage Protection**: Configurable max slippage on swaps
4. **In-Range Check**: Never rebalances if position is already in range
5. **Validation**: Validates all environment variables on startup

## Development

### Type Safety
- Strict TypeScript compilation
- No `any` types
- All function parameters fully typed
- Comprehensive interfaces for data structures

### Code Quality
- ESModuleInterop for modern imports
- Proper error boundaries
- Async/await throughout
- Winston structured logging

## License

ISC

## Support

For issues or questions, please open an issue on GitHub.
