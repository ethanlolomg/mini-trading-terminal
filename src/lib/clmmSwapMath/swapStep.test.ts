import { describe, expect, it } from "vitest";
import BN from "bn.js";
import { SwapMathUtil } from "./swapStep";
import { TickUtil } from "./tickMath";

const L = new BN(10).pow(new BN(15));
const FEE = 2500; // 0.25% of 1e6 denominator

describe("SwapMathUtil.computeSwap (oneForZero, base input)", () => {
  const current = TickUtil.getSqrtPriceAtTick(0);
  const target = TickUtil.getSqrtPriceAtTick(60); // price up => target > current

  it("reaches target with a large input and produces output", () => {
    const big = new BN(10).pow(new BN(18));
    const res = SwapMathUtil.computeSwap(current, target, L, big, FEE, true, false, true);
    expect(res.sqrtPriceNextX64.eq(target)).toBe(true);
    expect(res.amountIn.gt(new BN(0))).toBe(true);
    expect(res.amountOut.gt(new BN(0))).toBe(true);
    expect(res.feeAmount.gte(new BN(0))).toBe(true);
  });

  it("stops short of target with a tiny input", () => {
    const tiny = new BN(1000);
    const res = SwapMathUtil.computeSwap(current, target, L, tiny, FEE, true, false, true);
    expect(res.sqrtPriceNextX64.gt(current)).toBe(true);
    expect(res.sqrtPriceNextX64.lt(target)).toBe(true);
  });
});

describe("SwapMathUtil.computeSwap (zeroForOne, base input)", () => {
  const current = TickUtil.getSqrtPriceAtTick(0);
  const target = TickUtil.getSqrtPriceAtTick(-60); // price down => target < current

  it("reaches target with a large input and produces output", () => {
    const big = new BN(10).pow(new BN(18));
    const res = SwapMathUtil.computeSwap(current, target, L, big, FEE, true, true, true);
    expect(res.sqrtPriceNextX64.eq(target)).toBe(true);
    expect(res.amountIn.gt(new BN(0))).toBe(true);
    expect(res.amountOut.gt(new BN(0))).toBe(true);
  });
});
