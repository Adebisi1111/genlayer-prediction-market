# PredictionMarketResolver — AI-Resolved Prediction Market on GenLayer

An **Intelligent Contract** that resolves a binary prediction market **without a trusted oracle**. The contract stores a question, human-readable resolution rules, and up to three web sources. When `resolve()` is called, each GenLayer validator independently renders the live sources, asks an LLM to judge the outcome strictly from that evidence, and the network reaches **comparative consensus** on a final verdict: `YES`, `NO`, or `UNRESOLVED`.

## Why it matters

A normal smart contract cannot read a web page or make a judgement call, so prediction markets rely on a centralized oracle or a human resolver to report the result. GenLayer can do both natively. This contract shows a market that **settles itself** from public evidence, trustlessly, with the decision recorded on-chain.

## Live deployment (Testnet Bradbury)

- **Contract:** `0xd2Ead3C6BbaCe1D423F156762f33A2C9B406C73f`
- **Network:** GenLayer Testnet Bradbury (Chain ID `4221`)
- **Explorer:** https://explorer-bradbury.genlayer.com (search the contract address or the tx hashes below)

### Verified on-chain demo — verdict `YES`

- **Question:** *According to the cited sources, has Ethereum completed 'The Merge' and now runs on Proof-of-Stake?*
- **Sources:** `https://en.wikipedia.org/wiki/The_Merge`, `https://en.wikipedia.org/wiki/Ethereum`

| Step | Transaction hash |
| --- | --- |
| Deploy | `0xd5cadff271d913051954c9b67f3ce8fdf670b9e1ea79837915397fd8a687bcff` |
| resolve (AI verdict) | `0x1bdd2fb16036261169767c12b81e897100729213e761504bb89169f8c89f7661` |

Final state: `status = resolved`, `outcome = YES`. The validator network agreed, strictly from the cited evidence, that Ethereum completed The Merge and runs on Proof-of-Stake.

## How it works

1. **Deploy** sets the market: `question`, `rules`, and up to three source URLs. Status starts at `open`.
2. **add_source(url)** lets the market **creator** attach an extra source before resolution (validated to be an http(s) URL).
3. **resolve()** runs a non-deterministic block:
   - `gl.nondet.web.render(url, mode="text")` fetches the live text of each source,
   - `gl.nondet.exec_prompt(...)` asks an LLM to decide YES / NO / UNRESOLVED strictly from that evidence under the rules,
   - `gl.eq_principle.prompt_comparative(...)` makes validators reach consensus on the verdict (the correct equivalence principle for subjective LLM output).
4. The verdict and a human-readable rationale are written on-chain; status becomes `resolved`.

## Security & tests

Hardening applied (see `docs/SECURITY-AUDIT.md` for the full review):

- **Access control:** only the market `creator` can `add_source`.
- **Prompt-injection defense:** source text is explicitly framed as untrusted data; the model is constrained to a strict JSON enum.
- **Robust parsing:** malformed LLM output is caught and defaults to the safe `UNRESOLVED`.
- **Input validation:** sources must be http(s) URLs.
- **State guards:** a market cannot be resolved twice, cannot be resolved with no source, and cannot accept sources after resolution.

Automated suite (`test.mjs`), **5/5 passing** on live Testnet Bradbury:

- Live multi-source resolution returns YES from real sources.
- resolve() cannot run twice.
- add_source reverts after resolution.
- resolve() reverts with no source configured.
- Non-http(s) source URL is rejected.

**Known limitation:** this version records the adjudicated verdict and market state on-chain; it does not custody GEN stakes or pay out winners. On-chain stake custody and payout are the planned next iteration.

## Contract interface

- `get_state() -> dict` (view) — full market state.
- `add_source(url: str)` (write, creator-only) — attach an extra source while open.
- `resolve()` (write) — validators reach a verdict via consensus.

## Run it yourself

    npm install            # genlayer-js + viem
    cp .env.example .env   # then fill PRIVATE_KEY and ADDRESS of a funded Bradbury wallet
    npm run deploy         # deploys, writes contract.txt + deploy-tx.txt
    npm run interact       # end-to-end demo: read -> resolve -> read (verdict)
    npm run test           # automated security/behavior suite on live testnet

## Tech

- **Contract:** Python Intelligent Contract on GenVM (pinned py-genlayer runner).
- **Client:** genlayer-js on Node.js.
- **Consensus:** GenLayer Optimistic Democracy + Equivalence Principle (prompt_comparative).

## Files

- `contracts/prediction_market.py` — the PredictionMarketResolver Intelligent Contract.
- `deploy.mjs` — deploys the contract, saves address to contract.txt.
- `interact.mjs` — end-to-end demo (state -> resolve -> state).
- `test.mjs` — automated security/behavior test suite.
- `docs/SECURITY-AUDIT.md` — self-conducted security audit.
- `.github/workflows/ci.yml` — static checks (contract + client syntax).

## License

MIT — see `LICENSE`.
