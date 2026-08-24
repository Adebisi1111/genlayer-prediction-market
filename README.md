# PrimeX — GenLayer Prediction Market Factory

A factory contract that spawns unlimited prediction markets on GenLayer Bradbury. Markets resolve through **decentralized AI consensus**: validators independently fetch cited web sources, an LLM judges the outcome, and the network reaches comparative consensus. Traders stake GEN on outcomes; winners split the whole pool parimutuel-style.

- **Factory (live):** `0xF8bf266694Cc729d9e1032e9dA244febfE10b335` (Bradbury testnet)
- **Explorer:** https://explorer-bradbury.genlayer.com/address/0xF8bf266694Cc729d9e1032e9dA244febfE10b335
- **Live app:** https://adebisi1111.github.io/genlayer-prediction-market/

## Why it needs GenLayer

A prediction market must decide real-world questions from sources no single node can be trusted to read honestly. GenLayer validators independently fetch the cited web sources and reach comparative consensus on the same outcome, so the verdict is trustless and reproducible — not the opinion of one oracle. No other chain can do this natively.

## What the factory does

1. **Create markets** — unlimited markets, each with a unique ID, question, resolution rules, and up to 3 cited sources.
2. **Stake** — traders stake GEN on YES or NO. Parimutuel odds update live as the pool shifts.
3. **Resolve** — validators fetch cited web sources, run them through an LLM, and reach comparative consensus (YES / NO / UNRESOLVED).
4. **Settle** — locks the winning side once the outcome is decisive.
5. **Claim** — winners split the whole pool in proportion to their winning stake; payouts are computed and emitted on-chain.

## Payout math

Parimutuel: winners split the whole pool in proportion to their winning stake.

```
payout = your_winning_stake × total_pool ÷ winning_pool
```

Example: YES pool 1.0, NO pool 0.4, total 1.4 GEN, outcome YES. A YES staker of 1.0 claims 1.0 × 1.4 / 1.0 = 1.4 GEN.

## Contract API

Views (read-only, no gas):
- `getConfig()` — global config (market count, creator).
- `getMarket(id)` — full market state: status, outcome, pool, yes/no stakes, positions.
- `contractBalance()` — GEN held by the factory.
- `my_bal()` — this caller's GEN balance in the contract (always 0 — no per-wallet escrow).
- `getCreator()` — the authorized creator address.

Writes (require connected wallet):
- `createMarket(question, category, source_url)` — spawn a new market.
- `stake(id, side)` — stake GEN on YES or NO (send value with the call).
- `resolve(id)` — run validator consensus on the cited sources.
- `settle(id)` — lock the winning side.
- `claim(id)` — collect parimutuel winnings.

## Live data

- **Markets on-chain:** 7 (BTC >$100k, ETH >$5k, Man City PL, Fed cuts Q1, Apple foldable, Nigeria WC, PrimeX accepted)
- **Total escrowed:** ~10.97 GEN across all markets
- **Statuses:** 2 settled, 5 open
- **Staking and payout previews:** the frontend computes live odds from on-chain pool state

## Run it

```bash
# Deploy the factory
node gl_deploy.mjs contracts/factory_v15.py

# Seed markets
node seed_m6.mjs

# Serve the frontend
cd public && python3 -m http.server 8099
```

## Tests

```bash
# Wallet/connect + page flow
node wallet_test.mjs

# Rewards panel
node test_rewards.mjs

# YES/NO payout toggle
node test_toggle.mjs
```
