import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import Decimal from "decimal.js";
import BN from "bn.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function decimalToBN(decimal: Decimal): BN {
  const intStr = decimal.trunc().toFixed(0);
  return new BN(intStr, 10);
}

export function bn(value: Decimal | bigint): BN {
  if (value instanceof Decimal) {
    return decimalToBN(value);
  } else if (typeof value === "bigint") {
    return new BN(value.toString());
  } else {
    throw new Error(`Invalid type of value: ${value}`);
  }
}
