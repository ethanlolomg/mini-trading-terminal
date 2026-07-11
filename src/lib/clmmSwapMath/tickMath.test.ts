import { describe, expect, it } from "vitest";
import { Q64, MIN_TICK, MAX_TICK } from "./constants";
import { TickArrayUtil, TickUtil } from "./tickMath";

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
