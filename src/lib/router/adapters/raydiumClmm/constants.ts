import { PublicKey } from "@solana/web3.js";

/**
 * On-chain program IDs used by the in-house Raydium CLMM swap (Task 2).
 * TRUMP is a Token-2022 mint, so swaps must use CLMM `swap_v2`.
 */
export const RAYDIUM_CLMM_PROGRAM_ID = new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK");
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/** swap_v2 anchor discriminator. */
export const SWAP_V2_DISCRIMINATOR = Buffer.from([43, 4, 237, 11, 26, 201, 30, 98]);
