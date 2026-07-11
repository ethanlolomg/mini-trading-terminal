import { Connection, PublicKey } from "@solana/web3.js";
import {
  TickArrayBitmapUtil,
  TickArrayUtil,
  type ClmmConfigDecoded,
  type PoolInfoDecoded,
  type TickArrayBitmapExtensionDecoded,
  type TickArrayDecoded,
} from "@/lib/clmmSwapMath";
import { RAYDIUM_CLMM_PROGRAM_ID } from "./constants";
import { getPdaExBitmapAccount, getPdaTickArrayAddress } from "./pda";
import {
  decodeAmmConfig,
  decodePoolInfo,
  decodeTickArray,
  decodeTickArrayBitmapExtension,
  emptyTickArrayBitmapExtension,
} from "./layouts";

export interface ClmmPoolContext {
  poolId: PublicKey;
  poolInfo: PoolInfoDecoded;
  ammConfig: ClmmConfigDecoded;
  bitmapExt: TickArrayBitmapExtensionDecoded;
  exBitmapAddress: PublicKey;
}

/** Fetch + decode the pool state, its amm config, and the bitmap extension. */
export async function fetchClmmPool(connection: Connection, poolId: PublicKey): Promise<ClmmPoolContext> {
  const poolAcc = await connection.getAccountInfo(poolId);
  if (!poolAcc) throw new Error(`Raydium CLMM pool not found: ${poolId.toBase58()}`);
  const poolInfo = decodePoolInfo(poolAcc.data);

  const ammConfigId = poolInfo.configId as unknown as PublicKey;
  const exBitmapAddress = getPdaExBitmapAccount(RAYDIUM_CLMM_PROGRAM_ID, poolId);

  const [configAcc, exBitmapAcc] = await connection.getMultipleAccountsInfo([ammConfigId, exBitmapAddress]);
  if (!configAcc) throw new Error(`Amm config not found: ${ammConfigId.toBase58()}`);

  const ammConfig = decodeAmmConfig(configAcc.data);
  const bitmapExt = exBitmapAcc
    ? decodeTickArrayBitmapExtension(exBitmapAcc.data)
    : emptyTickArrayBitmapExtension();

  return { poolId, poolInfo, ammConfig, bitmapExt, exBitmapAddress };
}

/**
 * Fetch the tick arrays the swap may cross: the array containing the current
 * tick plus several on each side (mirrors the SDK's count-7 both-directions
 * scan). Returns only arrays that exist on-chain, decoded.
 */
export async function fetchTickArraysForSwap(
  connection: Connection,
  ctx: ClmmPoolContext,
): Promise<{ address: PublicKey; value: TickArrayDecoded }[]> {
  const { poolId, poolInfo, bitmapExt } = ctx;
  const { tickSpacing, tickCurrent, tickArrayBitmap } = poolInfo;

  const starts = new Set<number>();
  starts.add(TickArrayUtil.getTickArrayStartIndex(tickCurrent, tickSpacing));
  for (const type of ["zeroForOne", "oneForZero"] as const) {
    for (const s of TickArrayBitmapUtil.findTickArrayStartIndex({
      tickSpacing,
      poolBitmap: tickArrayBitmap,
      tickArrayBitmap: bitmapExt,
      findInfo: { type, count: 7, tickArrayCurrent: tickCurrent },
    })) {
      starts.add(s);
    }
  }

  const derived = [...starts].map((startIndex) => ({
    startIndex,
    address: getPdaTickArrayAddress(RAYDIUM_CLMM_PROGRAM_ID, poolId, startIndex),
  }));

  const infos = await connection.getMultipleAccountsInfo(derived.map((d) => d.address));

  const out: { address: PublicKey; value: TickArrayDecoded }[] = [];
  infos.forEach((info, i) => {
    if (info) out.push({ address: derived[i].address, value: decodeTickArray(info.data) });
  });
  return out;
}
