import { describe, expect, it } from "vitest";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import BN from "bn.js";
import { buildSwapTx } from "@/lib/router";
import { createConnection, createKeypair } from "@/lib/solana";

/**
 * Happy-path integration test: build a real Raydium CLMM swap_v2 transaction for
 * SOL -> TRUMP and simulate it against mainnet via Helius. No SOL is spent
 * (simulateTransaction). Asserts the program executed with no error and that the
 * CLMM Swap instruction ran.
 *
 * Requires VITE_HELIUS_RPC_URL and VITE_SOLANA_PRIVATE_KEY (the trading wallet,
 * which must hold a little SOL for the simulated wrap + ATA rent). Skipped
 * otherwise. Override the pool via VITE_TRUMP_SOL_CLMM_POOL if needed.
 */
const env = import.meta.env as Record<string, string | undefined>;
const RPC_URL = env.VITE_HELIUS_RPC_URL;
const PRIVATE_KEY = env.VITE_SOLANA_PRIVATE_KEY;
const shouldRun = Boolean(RPC_URL && PRIVATE_KEY);

const TRUMP_MINT = new PublicKey("6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN");
// Raydium CLMM SOL/TRUMP pool (override with VITE_TRUMP_SOL_CLMM_POOL).
const POOL_ADDRESS = env.VITE_TRUMP_SOL_CLMM_POOL ?? "EKmcEiMEExCBEg9Aw7HethY8UGm5KjPgSdhJeK9bQh6j";

describe.skipIf(!shouldRun)("raydium-clmm swapExactIn (integration)", () => {
  it(
    "builds and simulates a SOL -> TRUMP swap_v2 with no error",
    async () => {
      const connection = createConnection();
      const keypair = createKeypair(PRIVATE_KEY as string);

      const tx = await buildSwapTx("raydium-clmm", {
        inputMint: NATIVE_MINT,
        outputMint: TRUMP_MINT,
        amount: new BN(0.001 * LAMPORTS_PER_SOL),
        signer: keypair.publicKey,
        connection,
        poolAddress: POOL_ADDRESS,
      });

      const sim = await connection.simulateTransaction(tx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      });

      const logs = sim.value.logs ?? [];
      // Surface program logs when the assertion fails, to ease debugging.
      expect(sim.value.err, JSON.stringify(sim.value.err) + "\n" + logs.join("\n")).toBeNull();
      expect(logs.join("\n")).toContain("Instruction: Swap");
    },
    60_000,
  );
});
