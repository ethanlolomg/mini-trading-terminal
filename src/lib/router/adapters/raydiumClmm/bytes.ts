/**
 * Big-endian byte helper for Raydium CLMM PDA seeds.
 * Ported from Raydium SDK V2 (src/raydium/clmm/libraries/utils.ts).
 */
export function i32ToBytesBE(num: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(num);
  return buf;
}
