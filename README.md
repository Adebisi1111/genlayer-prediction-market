# PrimeX — GenLayer Prediction Market Factory

A factory contract that spawns unlimited prediction markets on GenLayer Bradbury. Markets resolve through **decentralized AI consensus**: validators independently fetch cited web sources, an LLM judges the outcome, and the network reaches comparative consensus. Traders stake GEN on outcomes; winners split the whole pool parimutuel-style.

- **Factory (live):** `0x1168b74Cf4C9C42c7c1D7A16ed927774d8974275` (Bradbury testnet)
- **Explorer:** https://explorer-bradbury.genlayer.com/address/0x1168b74Cf4C9C42c7c1D7A16ed927774d8974275
- **Live app:** https://adebisi1111.github.io/genlayer-prediction-market/

## Why it needs GenLayer

A prediction market must decide real-world questions from sources no single node can be trusted to read honestly. GenLayer validators independently fetch the cited web sources and reach comparative consensus on the same outcome, so the verdict is trustless and reproducible — not the opinion of one oracle. No other chain can do this natively.

## What the factory does

1. **Create markets** — unlimited markets, each with a unique ID and question.
2. **Stake** — traders stake GEN on YES or NO. Parimutuel odds update live as the pool shifts.
3. **Resolve** — validators fetch cited web sources, run them through an LLM, and reach comparative consensus.
4. **Settle** — locks the winning side once the outcome is decisive.
5. **Claim** — winners split the whole pool in proportion to their winning stake; payouts are computed and emitted on-chain. Each wallet can only claim once per market.

## Payout math

Parimutuel: winners split the whole pool in proportion to their winning stake.

```
payout = your_winning_stake × total_pool ÷ winning_pool
```

Example: YES pool 1.0, NO pool 0.4, total 1.4 GEN, outcome YES. A YES staker of 1.0 claims 1.0 × 1.4 / 1.0 = 1.4 GEN.

## Contract API

Views (read-only, no gas):
- `getConfig()` — global config (market count).
- `getMarket(id)` — full market state: status, outcome, pool, positions.

Writes (require connected wallet):
- `createMarket(question)` — spawn a new market.
- `stake(id, side)` — stake GEN on YES or NO (send value with the call).
- `resolve(id)` — run validator consensus on the cited sources.
- `settle(id)` — lock the winning side.
- `claim(id)` — collect parimutuel winnings (one-time per wallet).

## Live data

- **Markets on-chain:** 0 (fresh deployment)
- **Total escrowed:** 0 GEN
- **Staking and payout previews:** the frontend computes live odds from on-chain pool state

## Run it

```bash
# Deploy the factory
genlayer deploy --contract contracts/factory_v20.py

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

## Rewards Panel

Live at: https://adebisi1111.github.io/genlayer-prediction-market/rewards.html
