/**
 * Raydium CLMM swap math — fixed-point / big-number primitives.
 *
 * Adapted from Raydium SDK V2 (src/raydium/clmm/libraries/bigNum.ts),
 * Apache-2.0. https://github.com/raydium-io/raydium-sdk-V2
 *
 * Standard Uniswap-V3-style fixed-point helpers. Only the primitives the swap
 * engine actually uses are kept.
 */
import BN from "bn.js"
import { BN_ONE, BN_ZERO } from "./constants"

export function mulDivFloor(a: BN, b: BN, denominator: BN): BN {
  if (denominator.isZero()) {
    throw new Error("Division by zero")
  }
  return a.mul(b).div(denominator)
}

export function mulDivCeil(a: BN, b: BN, denominator: BN): BN {
  if (denominator.isZero()) {
    throw new Error("Division by zero")
  }
  const product = a.mul(b)
  const quotient = product.div(denominator)
  const remainder = product.mod(denominator)

  if (remainder.isZero()) {
    return quotient
  }
  return quotient.addn(1)
}

export function divRoundingUp(x: BN, y: BN) {
  return x.div(y).add(x.mod(y).isZero() ? BN_ZERO : BN_ONE)
}

export function mostSignificantBit(n: BN): number {
  if (n.isZero()) {
    return -1
  }
  return n.bitLength() - 1
}
