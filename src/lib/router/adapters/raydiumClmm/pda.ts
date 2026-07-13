import { PublicKey } from "@solana/web3.js";
import { i32ToBytesBE } from "./bytes";

/**
 * Raydium CLMM PDA derivation (tick_array + bitmap-extension only).
 * Ported from Raydium SDK V2 (src/raydium/clmm/libraries/pda.ts); uses
 * PublicKey.findProgramAddressSync directly instead of the SDK's
 * findProgramAddress shim.
 */
const TICK_ARRAY_SEED = Buffer.from("tick_array", "utf8");
const POOL_TICK_ARRAY_BITMAP_SEED = Buffer.from("pool_tick_array_bitmap_extension", "utf8");

export function getPdaTickArrayAddress(programId: PublicKey, poolId: PublicKey, startIndex: number): PublicKey {
  const [pk] = PublicKey.findProgramAddressSync(
    [TICK_ARRAY_SEED, poolId.toBuffer(), i32ToBytesBE(startIndex)],
    programId,
  );
  return pk;
}

export function getPdaExBitmapAccount(programId: PublicKey, poolId: PublicKey): PublicKey {
  const [pk] = PublicKey.findProgramAddressSync(
    [POOL_TICK_ARRAY_BITMAP_SEED, poolId.toBuffer()],
    programId,
  );
  return pk;
}
