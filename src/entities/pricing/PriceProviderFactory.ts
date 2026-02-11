import { PriceProvider } from "./PriceProvider";
import { PythPriceProvider } from "./PythPriceProvider";
import { AggregatorPriceProvider } from "./AggregatorPriceProvider";
import { CacheablePriceProvider } from "./CacheablePriceProvider";
import { CACHE_CONFIG } from "../../config/cache";

export enum PriceProviderType {
  PYTH = "pyth",
  AGGREGATED = "aggregated",
}

export class PriceProviderFactory {
  /**
   * Creates a price provider with caching enabled by default
   * 
   * @param type The type of price provider to create
   * @param enableCache Whether to enable caching (default: true)
   * @returns A price provider
   */
  static createProvider(
    type: PriceProviderType = PriceProviderType.AGGREGATED,
    enableCache: boolean = true
  ): PriceProvider {
    let provider: PriceProvider;

    switch (type) {
      case PriceProviderType.PYTH:
        provider = new PythPriceProvider();
        return enableCache 
          ? new CacheablePriceProvider(
              provider, 
              CACHE_CONFIG.PYTH_PRICE_TTL, 
              "prices:pyth"
            )
          : provider;

      case PriceProviderType.AGGREGATED:
      default:
        // AggregatorPriceProvider already has caching internally
        return new AggregatorPriceProvider();
    }
  }
} 