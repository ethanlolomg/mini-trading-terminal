/**
 * Big-endian byte helpers for Raydium CLMM PDA seeds.
 * Ported from Raydium SDK V2 (src/raydium/clmm/libraries/utils.ts).
 */
export function i32ToBytesBE(num: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(num);
  return buf;
}

export function u16ToBytesBE(num: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16BE(num);
  return buf;
}
