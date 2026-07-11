/**
 * Raydium CLMM swap math — decoded account shapes.
 *
 * These interfaces describe the fields the swap engine reads from decoded
 * on-chain accounts. Upstream (Raydium SDK V2) uses `ReturnType<typeof
 * XxxLayout.decode>` from src/raydium/clmm/layout.ts; we express them as plain
 * interfaces so this math package has no dependency on the layout/marshmallow
 * code. The Phase 2 layout decoders must produce objects assignable to these.
 */
import type BN from "bn.js";

export interface DynamicFeeInfoState {
  filterPeriod: number;
  decayPeriod: number;
  reductionFactor: number;
  dynamicFeeControl: number;
  maxVolatilityAccumulator: number;
  tickSpacingIndexReference: number;
  volatilityReference: number;
  volatilityAccumulator: number;
  lastUpdateTimestamp: BN;
}

export interface PoolInfoDecoded {
  configId: PublicKeyLike;
  mintA: PublicKeyLike;
  mintB: PublicKeyLike;
  vaultA: PublicKeyLike;
  vaultB: PublicKeyLike;
  observationId: PublicKeyLike;
  mintDecimalsA: number;
  mintDecimalsB: number;
  tickSpacing: number;
  liquidity: BN;
  sqrtPriceX64: BN;
  tickCurrent: number;
  feeGrowthGlobalX64A: BN;
  feeGrowthGlobalX64B: BN;
  feeOn: number;
  tickArrayBitmap: Buffer;
  dynamicFeeInfo: DynamicFeeInfoState;
}

export interface ClmmConfigDecoded {
  index: number;
  tickSpacing: number;
  protocolFeeRate: number;
  tradeFeeRate: number;
  fundFeeRate: number;
}

export interface TickDecoded {
  tick: number;
  liquidityNet: BN;
  liquidityGross: BN;
  orderPhase: BN;
  ordersAmount: BN;
  partFilledOrdersRemaining: BN;
  unfilledRatioX64: BN;
}

export interface TickArrayDecoded {
  startTickIndex: number;
  ticks: TickDecoded[];
}

export interface TickArrayBitmapExtensionDecoded {
  positiveTickArrayBitmap: Buffer;
  negativeTickArrayBitmap: Buffer;
}

/**
 * Minimal structural type for a `@solana/web3.js` PublicKey. Kept structural so
 * this package doesn't need to import web3.js for the identity fields it merely
 * passes through.
 */
export interface PublicKeyLike {
  toString(): string;
  toBuffer(): Buffer;
  equals(other: PublicKeyLike): boolean;
}
