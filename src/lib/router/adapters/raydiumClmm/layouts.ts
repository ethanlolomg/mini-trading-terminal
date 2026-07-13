import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import type {
  ClmmConfigDecoded,
  PoolInfoDecoded,
  TickArrayBitmapExtensionDecoded,
  TickArrayDecoded,
  TickDecoded,
} from "@/lib/clmmSwapMath";

/**
 * In-house binary decoders for the Raydium CLMM accounts the swap engine reads.
 *
 * Rather than vendoring the SDK's marshmallow + @solana/buffer-layout, this uses
 * a small sequential cursor (`Reader`) that walks each account's fields in the
 * exact order declared in Raydium SDK V2's clmm/layout.ts. Because it advances
 * field-by-field, byte offsets are implicit — we only transcribe field
 * order/sizes and skip the parts the swap math doesn't need. Little-endian
 * on-chain encoding; signed integers use two's-complement.
 */
class Reader {
  offset = 0;
  constructor(private readonly buf: Buffer) {}

  skip(n: number): this {
    this.offset += n;
    return this;
  }

  private bn(len: number, signed: boolean): BN {
    const slice = this.buf.subarray(this.offset, this.offset + len);
    this.offset += len;
    const v = new BN(slice, 10, "le");
    return signed ? v.fromTwos(len * 8) : v;
  }

  u8(): number {
    const v = this.buf.readUInt8(this.offset);
    this.offset += 1;
    return v;
  }
  u16(): number {
    const v = this.buf.readUInt16LE(this.offset);
    this.offset += 2;
    return v;
  }
  u32(): number {
    const v = this.buf.readUInt32LE(this.offset);
    this.offset += 4;
    return v;
  }
  i32(): number {
    const v = this.buf.readInt32LE(this.offset);
    this.offset += 4;
    return v;
  }
  u64(): BN {
    return this.bn(8, false);
  }
  u128(): BN {
    return this.bn(16, false);
  }
  i128(): BN {
    return this.bn(16, true);
  }
  pubkey(): PublicKey {
    const slice = this.buf.subarray(this.offset, this.offset + 32);
    this.offset += 32;
    return new PublicKey(slice);
  }
  blob(n: number): Buffer {
    const slice = Buffer.from(this.buf.subarray(this.offset, this.offset + n));
    this.offset += n;
    return slice;
  }
}

// Reward info is not needed by the swap loop; its fixed span is skipped.
// RewardInfoLayout = u8 + 3*u64 + u128 + 2*u64 + 3*pubkey + u128 = 169 bytes.
const REWARD_INFO_SPAN = 169;
const REWARD_NUM = 3;

export function decodePoolInfo(data: Buffer): PoolInfoDecoded {
  const r = new Reader(data);
  r.skip(8); // anchor discriminator
  r.skip(1); // bump
  const configId = r.pubkey();
  r.skip(32); // creator
  const mintA = r.pubkey();
  const mintB = r.pubkey();
  const vaultA = r.pubkey();
  const vaultB = r.pubkey();
  const observationId = r.pubkey();
  const mintDecimalsA = r.u8();
  const mintDecimalsB = r.u8();
  const tickSpacing = r.u16();
  const liquidity = r.u128();
  const sqrtPriceX64 = r.u128();
  const tickCurrent = r.i32();
  r.skip(4); // padding u32
  const feeGrowthGlobalX64A = r.u128();
  const feeGrowthGlobalX64B = r.u128();
  r.skip(8 + 8); // protocolFeesTokenA/B
  r.skip(16 * 4); // swapInAmount/swapOutAmount (4 x u128)
  r.skip(1); // status
  const feeOn = r.u8();
  r.skip(6); // padding
  r.skip(REWARD_INFO_SPAN * REWARD_NUM); // rewardInfos
  const tickArrayBitmap = r.blob(8 * 16); // 128 bytes
  // remaining fields (totalFees, fundFees, startTime, recentEpoch, dynamic fee) are unused
  return {
    configId,
    mintA,
    mintB,
    vaultA,
    vaultB,
    observationId,
    mintDecimalsA,
    mintDecimalsB,
    tickSpacing,
    liquidity,
    sqrtPriceX64,
    tickCurrent,
    feeGrowthGlobalX64A,
    feeGrowthGlobalX64B,
    feeOn,
    tickArrayBitmap,
  };
}

export function decodeAmmConfig(data: Buffer): ClmmConfigDecoded {
  const r = new Reader(data);
  r.skip(8); // discriminator
  r.skip(1); // bump
  const index = r.u16();
  r.skip(32); // owner
  const protocolFeeRate = r.u32();
  const tradeFeeRate = r.u32();
  const tickSpacing = r.u16();
  const fundFeeRate = r.u32();
  return { index, protocolFeeRate, tradeFeeRate, tickSpacing, fundFeeRate };
}

function decodeTick(r: Reader): TickDecoded {
  const tick = r.i32();
  const liquidityNet = r.i128();
  const liquidityGross = r.u128();
  r.skip(16 + 16); // feeGrowthOutsideX64A/B
  r.skip(16 * REWARD_NUM); // rewardGrowthsOutsideX64
  r.skip(52); // padding[u32; 13] (the swap loop only needs liquidity net/gross)
  return {
    tick,
    liquidityNet,
    liquidityGross,
  };
}

const TICK_ARRAY_SIZE = 60;

export function decodeTickArray(data: Buffer): TickArrayDecoded {
  const r = new Reader(data);
  r.skip(8); // discriminator
  r.skip(32); // poolId
  const startTickIndex = r.i32();
  const ticks: TickDecoded[] = [];
  for (let i = 0; i < TICK_ARRAY_SIZE; i++) {
    ticks.push(decodeTick(r));
  }
  return { startTickIndex, ticks };
}

const EXTENSION_BITMAP_SPAN = 8 * 8 * 14; // 896 bytes each

export function decodeTickArrayBitmapExtension(data: Buffer): TickArrayBitmapExtensionDecoded {
  const r = new Reader(data);
  r.skip(8); // discriminator
  r.skip(32); // poolId
  const positiveTickArrayBitmap = r.blob(EXTENSION_BITMAP_SPAN);
  const negativeTickArrayBitmap = r.blob(EXTENSION_BITMAP_SPAN);
  return { positiveTickArrayBitmap, negativeTickArrayBitmap };
}

/** Zeroed bitmap extension for pools whose extension account is uninitialized. */
export function emptyTickArrayBitmapExtension(): TickArrayBitmapExtensionDecoded {
  return {
    positiveTickArrayBitmap: Buffer.alloc(EXTENSION_BITMAP_SPAN),
    negativeTickArrayBitmap: Buffer.alloc(EXTENSION_BITMAP_SPAN),
  };
}
