import { describe, expect, it } from "vitest";
import BN from "bn.js";
import {
  MAX_TICK,
  MIN_TICK,
  Q64,
  divRoundingUp,
  mostSignificantBit,
  mulDivCeil,
  mulDivFloor,
  LiquidityMathUtil,
  SqrtPriceMath,
  TickArrayUtil,
  TickUtil,
} from "./math";

const L = new BN(10).pow(new BN(15));
const amountIn = new BN(10).pow(new BN(9));

describe("fixedPoint", () => {
  it("mulDivFloor floors, mulDivCeil ceils", () => {
    const a = new BN(7);
    const b = new BN(1);
    const d = new BN(2);
    expect(mulDivFloor(a, b, d).toString()).toBe("3");
    expect(mulDivCeil(a, b, d).toString()).toBe("4");
  });

  it("mulDiv is exact when divisible", () => {
    expect(mulDivFloor(new BN(8), new BN(1), new BN(2)).toString()).toBe("4");
    expect(mulDivCeil(new BN(8), new BN(1), new BN(2)).toString()).toBe("4");
  });

  it("divRoundingUp rounds up on remainder", () => {
    expect(divRoundingUp(new BN(5), new BN(2)).toString()).toBe("3");
    expect(divRoundingUp(new BN(4), new BN(2)).toString()).toBe("2");
  });

  it("mostSignificantBit matches bit length - 1", () => {
    expect(mostSignificantBit(new BN(0))).toBe(-1);
    expect(mostSignificantBit(new BN(1))).toBe(0);
    expect(mostSignificantBit(new BN(255))).toBe(7);
    expect(mostSignificantBit(new BN(256))).toBe(8);
  });

  it("throws on division by zero", () => {
    expect(() => mulDivFloor(new BN(1), new BN(1), new BN(0))).toThrow();
  });
});

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

describe("TickUtil.getSqrtPriceAtTick", () => {
  it("returns Q64 (2^64) at tick 0", () => {
    expect(TickUtil.getSqrtPriceAtTick(0).toString()).toBe(Q64.toString());
  });

  it("is monotonic increasing in tick", () => {
    const p0 = TickUtil.getSqrtPriceAtTick(0);
    const pUp = TickUtil.getSqrtPriceAtTick(100);
    const pDown = TickUtil.getSqrtPriceAtTick(-100);
    expect(pUp.gt(p0)).toBe(true);
    expect(pDown.lt(p0)).toBe(true);
  });

  it("rejects out-of-range ticks", () => {
    expect(() => TickUtil.getSqrtPriceAtTick(MAX_TICK + 1)).toThrow();
    expect(() => TickUtil.getSqrtPriceAtTick(MIN_TICK - 1)).toThrow();
  });
});

describe("tick <-> sqrtPrice round trip", () => {
  const ticks = [0, 1, -1, 100, -100, 1000, -1000, 85176, -85176, 200000, -200000];
  for (const t of ticks) {
    it(`recovers tick ${t} from its sqrtPrice`, () => {
      const sqrtPrice = TickUtil.getSqrtPriceAtTick(t);
      expect(TickUtil.getTickAtSqrtPrice(sqrtPrice)).toBe(t);
    });
  }
});

describe("TickArrayUtil", () => {
  it("computes tick-array start index aligned to spacing*size", () => {
    // spacing 10 => 600 ticks per array
    expect(TickArrayUtil.tickCount(10)).toBe(600);
    expect(TickArrayUtil.getTickArrayStartIndex(0, 10)).toBe(0);
    expect(TickArrayUtil.getTickArrayStartIndex(605, 10)).toBe(600);
    expect(TickArrayUtil.getTickArrayStartIndex(-1, 10)).toBe(-600);
  });
});
