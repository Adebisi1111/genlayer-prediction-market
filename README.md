# 🧠 GenLayer Prediction Market Resolver

An **Intelligent Contract** on GenLayer that resolves prediction-market questions by reading cited web sources and reaching AI-validator **consensus** on the outcome — now with a built-in **dispute & re-resolution workflow** and an **immutable on-chain resolution history**.

> Network: **Bradbury testnet** (Chain ID 4221) · Explorer: https://explorer-bradbury.genlayer.com

## ✨ What's new in v0.2.0

- **Dispute workflow** — anyone can contest a resolved market with a written reason. The contract re-runs the full AI resolution, treating the disputant's claim as *untrusted context* (evidence and rules always win — a dispute is never a command).
- **On-chain resolution history** — every resolution and dispute is appended to an immutable `history` list: `{round, kind, outcome, rationale, by, note}`.
- **Consensus-robust resolution** — the resolver prompt now degrades gracefully when a source fails to load, so independent validators converge on the same outcome value instead of stalling in the consensus round.
- **Anti-abuse cap** — a market accepts at most **2 disputes**.

## 🔍 How it works

1. A market is deployed with a `question`, `rules`, and up to three source URLs.
2. `resolve()` fetches each source with `gl.nondet.web.render`, builds a strict resolver prompt, and settles the outcome (`YES` / `NO` / `UNRESOLVED`) via `gl.eq_principle.prompt_comparative` — validators must agree on the final outcome value, not the wording.
3. `dispute(reason)` re-runs the same resolution with an extra **untrusted** `DISPUTANT CONTEXT` block. A weak or false dispute does **not** flip a well-evidenced outcome.
4. Every round is written to `history`, fully auditable on-chain.

## 📜 Contract API

```py
resolve()                # settle an open market from its sources (YES / NO / UNRESOLVED)
dispute(reason: str)     # contest a resolved market -> re-runs resolution, appends history (max 2)
add_source(url: str)     # creator-only, http(s) only, before resolution
get_state() -> dict      # full state incl. outcome, rationale, dispute_note, history
```

## 🚀 Live deployments (Bradbury testnet)

**v0.2.0 (current)** — contract [`0x5853abFE0CBF83ac65cd3DACFB35Bb1B0314C969`](https://explorer-bradbury.genlayer.com/address/0x5853abFE0CBF83ac65cd3DACFB35Bb1B0314C969)
- deploy tx: [`0x9c21adca…`](https://explorer-bradbury.genlayer.com/tx/0x9c21adcaf07c8d26c35331bb86afbf257150acfd0eb468129b5367b9530dce8b)
- resolve tx (→ **YES**): [`0x6c35f15a…`](https://explorer-bradbury.genlayer.com/tx/0x6c35f15a1fbfd097a5f6a87b91db52c7187cb3b6efdd65ddf2d6fea287807619)
- dispute tx (false claim — outcome **held YES**): [`0x1fe419ff…`](https://explorer-bradbury.genlayer.com/tx/0x1fe419ff3de11fa15578ad050493b0bb23d1e52623a517a534ee4a92c29a7754)

**v0.1.0** — contract [`0xd2Ead3C6BbaCe1D423F156762f33A2C9B406C73f`](https://explorer-bradbury.genlayer.com/address/0xd2Ead3C6BbaCe1D423F156762f33A2C9B406C73f)
- resolve tx (→ **YES**): [`0x1bdd2fb1…`](https://explorer-bradbury.genlayer.com/tx/0x1bdd2fb16036261169767c12b81e897100729213e761504bb89169f8c89f7661)

## 🛠️ Local usage

```bash
npm install
# create .env with: PRIVATE_KEY=0xYOUR_TESTNET_KEY
node --env-file=.env deploy.mjs       # deploy a fresh market
node --env-file=.env interact.mjs     # resolve -> dispute demo (robust submit-retry)
node --env-file=.env test.mjs         # full test suite (9/9)
```

## 🔒 Security

See [`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md) — covers prompt-injection handling for both in-source evidence and disputant context, consensus-robustness against partial source failures, submission ordering on the consensus contract, and access control.

## 🧩 Tech

GenLayer Intelligent Contract (Python) · `genlayer-js` SDK · Bradbury testnet · zero external stubs, all resolutions run through real on-chain AI consensus.
