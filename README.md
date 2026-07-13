# Mini Trading Terminal

Solana token trading UI with a floating instant-trade panel and an in-house Raydium CLMM swap path (Jupiter as fallback).

## Demo

- **Loom:** https://www.loom.com/share/5848aa7e54414a408de883ba2f47b2a3
- **Solscan — buy TRUMP:** https://solscan.io/tx/2XjWFdBPdmtTWHBwVuH92bf4jkwzouJPrDev7QXnN6PvtwmJNjLjLwno1yEDvSUKxXatKKxowqxvrRYKPJUqeVdB
- **Solscan — sell TRUMP:** https://solscan.io/tx/3nPkpiHjqLQ3fbyWqqtNGvLzAmgadL4rz2DeukXqHLFJ79CGLpaFN4C7KmrLTGMBNaymcFimQuhxyuGBAHkZJfxq

Both are successful in-house Raydium CLMM `swap_v2` transactions (no Jupiter, no SDK).

## What's implemented

### Task 1 — Instant Trade panel
- Toggle under the chart (desktop only)
- Draggable / resizable floating panel (Zustand persistence for position, size, and P1–P3 presets)
- One-click buy (SOL amounts) and sell (% of token balance)
- Shared balance context so the sidebar and floating panel stay in sync

### Task 2 — Raydium CLMM (in-house)
- Route resolution: Raydium CLMM + SOL pool → in-house `swap_v2` exact-in; otherwise Jupiter Ultra
- Pool state + tick arrays fetched via Helius RPC (no Raydium SDK / third-party swap API)
- Builds a `VersionedTransaction` with WSOL wrap/unwrap and Token-2022 support (e.g. TRUMP)
- CLMM swap math lives in its own package (`src/lib/clmmSwapMath`) so other CLMM adapters can reuse it and we can grow it (e.g. exact-out) without coupling to the Raydium tx builder

## Known limitations

- **SOL ↔ SOL** — not supported (no meaningful swap path)
- **Slippage & priority fee** — profile settings apply only on the in-house Raydium CLMM path. Jupiter-routed swaps use Jupiter Ultra’s own dynamic slippage and priority fee, because Ultra returns a pre-built transaction we don’t modify
- **Quote asset** — trading is SOL-quoted only today (buy in SOL / sell token → SOL)
- **Route picking** — `resolveRoute` is intentionally simple (first matching Raydium CLMM + SOL pool, else Jupiter)

## Future improvements

- Support non-SOL quote assets
- Exact-out swaps; separate buy vs sell slippage configs
- Smarter route resolution (liquidity, fee tier, multi-hop / best venue)

## Setup

```bash
npm install
```

Create a `.env` (see assignment brief):

```env
VITE_CODEX_API_KEY=
VITE_HELIUS_RPC_URL=
VITE_JUPITER_REFERRAL_ACCOUNT=
VITE_SOLANA_PRIVATE_KEY=
```

Fund the wallet with a little SOL for testing.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm run test:unit          # math + router (no network)
npm run test:integration   # Raydium CLMM build + simulate (needs Helius + key)
```
