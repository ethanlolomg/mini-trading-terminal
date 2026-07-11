import { describe, expect, it } from "vitest";
import BN from "bn.js";
import { divRoundingUp, mostSignificantBit, mulDivCeil, mulDivFloor } from "./fixedPoint";

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
