/**
 * Raydium CLMM swap math — pool fee helpers.
 *
 * Adapted from Raydium SDK V2 (src/raydium/clmm/libraries/pool.ts), Apache-2.0.
 * https://github.com/raydium-io/raydium-sdk-V2
 *
 * Only the stateless helper the swap loop needs is kept; the RPC-bound PoolUtils
 * methods are replaced by the thin in-house exact-in wrapper.
 */
import { CollectFeeOn } from "./constants";

export class PoolUtil {
  static isFeeOnInput(feeOn: number, zeroForOne: boolean): boolean {
    switch (feeOn) {
      case CollectFeeOn.FromInput:
        return true;
      case CollectFeeOn.TokenOnlyA:
        return zeroForOne;
      case CollectFeeOn.TokenOnlyB:
        return !zeroForOne;
      default:
        return true;
    }
  }
}
