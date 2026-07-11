import { describe, expect, it } from "vitest";
import BN from "bn.js";
import { SqrtPriceMath } from "./sqrtPriceMath";
import { LiquidityMathUtil } from "./liquidityMath";
import { TickUtil } from "./tickMath";

const L = new BN(10).pow(new BN(15));
const amountIn = new BN(10).pow(new BN(9));

describe("SqrtPriceMath.getNextSqrtPriceFromInput", () => {
  const current = TickUtil.getSqrtPriceAtTick(0);

  it("decreases price for zeroForOne (token0 in)", () => {
    const next = SqrtPriceMath.getNextSqrtPriceFromInput(current, L, amountIn, true);
    expect(next.lt(current)).toBe(true);
  });

  it("increases price for oneForZero (token1 in)", () => {
    const next = SqrtPriceMath.getNextSqrtPriceFromInput(current, L, amountIn, false);
    expect(next.gt(current)).toBe(true);
  });

  it("throws with zero liquidity", () => {
    expect(() => SqrtPriceMath.getNextSqrtPriceFromInput(current, new BN(0), amountIn, false)).toThrow();
  });
});

describe("LiquidityMathUtil delta amounts", () => {
  it("token B delta over a positive price range is positive", () => {
    const lower = TickUtil.getSqrtPriceAtTick(0);
    const upper = TickUtil.getSqrtPriceAtTick(60);
    const amtB = LiquidityMathUtil.getDeltaAmountBUnsigned(lower, upper, L, false);
    expect(amtB.gt(new BN(0))).toBe(true);
  });

  it("addDelta adds and subtracts signed liquidity", () => {
    expect(LiquidityMathUtil.addDelta(new BN(100), new BN(25)).toString()).toBe("125");
    expect(LiquidityMathUtil.addDelta(new BN(100), new BN(-25)).toString()).toBe("75");
    expect(() => LiquidityMathUtil.addDelta(new BN(10), new BN(-25))).toThrow();
  });
});
