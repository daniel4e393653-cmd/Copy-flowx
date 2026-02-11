import { Protocol } from "./utils/sdkTypes";
import BN from "bn.js";

export type BigintIsh = BN | string | number;

export type ClmmProtocol = Protocol.CETUS;

export enum Rounding {
  ROUND_DOWN,
  ROUND_HALF_UP,
  ROUND_UP,
}

export const TICK_INDEX_BITS = 32;
export const LIQUIDITY_BITS = 128;
export const Q128 = new BN(2).pow(new BN(128));

export const REBALANCE_RETRIES = Number(process.env.REBALANCE_RETRIES ?? 1);

// Cetus CLMM configuration for mainnet
export const CETUS_CONFIG = {
  // These will be filled from Cetus SDK initialization
  packageId: "",
  globalConfigId: "",
  poolsId: "",
};

export const MAPPING_POSITION_OBJECT_TYPE: Record<
  ClmmProtocol,
  string | undefined
> = {
  [Protocol.CETUS]:
    "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::position::Position",
};

export const MAPPING_POOL_OBJECT_TYPE: Record<
  ClmmProtocol,
  string | undefined
> = {
  [Protocol.CETUS]:
    "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::Pool",
};

// FlowX Aggregator Router - used for swap routing (not CLMM positions)
export const FLOWX_AG_UNIVERSAL_ROUTER_PACKAGE_ID = "0xc263060d3cbb4155057f0010f92f63ca56d5121c298d01f7a33607342ec299b0";