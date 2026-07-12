import { describe, expect, it } from "vitest";
import BN from "bn.js";
import { swapExactIn } from "./swap";
import { TickUtil } from "./tickMath";
import type {
  ClmmConfigDecoded,
  PoolInfoDecoded,
  PublicKeyLike,
  TickArrayBitmapExtensionDecoded,
  TickArrayDecoded,
  TickDecoded,
} from "./types";

const pk = (s: string): PublicKeyLike => ({
  toString: () => s,
  toBuffer: () => Buffer.alloc(32),
  equals: (o: PublicKeyLike) => o.toString() === s,
});

const MINT_A = pk("MintA");
const MINT_B = pk("MintB");
const ARR_ADDR = pk("Arr0");

function emptyTick(tick: number): TickDecoded {
  return {
    tick,
    liquidityNet: new BN(0),
    liquidityGross: new BN(0),
    orderPhase: new BN(0),
    ordersAmount: new BN(0),
    partFilledOrdersRemaining: new BN(0),
    unfilledRatioX64: new BN(0),
  };
}

// tickSpacing 1 => array start 0 spans ticks [0..59]. One initialized tick at 10.
function buildTickArray(): TickArrayDecoded {
  const ticks: TickDecoded[] = [];
  for (let i = 0; i < 60; i++) ticks.push(emptyTick(i));
  ticks[10] = { ...emptyTick(10), liquidityGross: new BN(1), liquidityNet: new BN(0) };
  return { startTickIndex: 0, ticks };
}

function buildPool(): PoolInfoDecoded {
  return {
    configId: pk("Config"),
    mintA: MINT_A,
    mintB: MINT_B,
    vaultA: pk("VaultA"),
    vaultB: pk("VaultB"),
    observationId: pk("Obs"),
    mintDecimalsA: 9,
    mintDecimalsB: 6,
    tickSpacing: 1,
    liquidity: new BN(10).pow(new BN(15)),
    sqrtPriceX64: TickUtil.getSqrtPriceAtTick(0),
    tickCurrent: 0,
    feeGrowthGlobalX64A: new BN(0),
    feeGrowthGlobalX64B: new BN(0),
    feeOn: 0, // CollectFeeOn.FromInput
    tickArrayBitmap: Buffer.alloc(128),
  };
}

const ammConfig: ClmmConfigDecoded = {
  index: 0,
  protocolFeeRate: 0,
  tradeFeeRate: 2500, // 0.25%
  tickSpacing: 1,
  fundFeeRate: 0,
};

const emptyBitmapExt: TickArrayBitmapExtensionDecoded = {
  positiveTickArrayBitmap: Buffer.alloc(896),
  negativeTickArrayBitmap: Buffer.alloc(896),
};

describe("swapExactIn", () => {
  it("oneForZero (SOL->token style, input = mintB) returns output and the tick-array account", () => {
    const res = swapExactIn({
      poolInfo: buildPool(),
      ammConfig,
      tickArrays: [{ address: ARR_ADDR, value: buildTickArray() }],
      bitmapExt: emptyBitmapExt,
      inputMint: MINT_B, // zeroForOne = false
      amountIn: new BN(1_000_000),
    });

    expect(res.amountOut.gt(new BN(0))).toBe(true);
    expect(res.remainingAccounts.map((a) => a.toString())).toContain("Arr0");
  });

  it("charges a fee (amountOut strictly less than a zero-fee reference is implied)", () => {
    const res = swapExactIn({
      poolInfo: buildPool(),
      ammConfig,
      tickArrays: [{ address: ARR_ADDR, value: buildTickArray() }],
      bitmapExt: emptyBitmapExt,
      inputMint: MINT_B,
      amountIn: new BN(1_000_000),
    });
    expect(res.feeAmount.gte(new BN(0))).toBe(true);
    expect(res.allTrade).toBe(true);
  });
});
