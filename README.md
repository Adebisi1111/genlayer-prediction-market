# GenLayer Prediction Market Resolver

An Intelligent Contract that resolves YES/NO prediction markets on GenLayer by having validators reach optimistic-democracy consensus over live web evidence, then binds that verdict to a verifiable market record and settles real stakes through it.

- Live contract (v0.3.0): `0x86d36795b66c29A7445945585a4C9f09C289C8ba` (Bradbury testnet)
- Explorer: https://explorer-bradbury.genlayer.com/address/0x86d36795b66c29A7445945585a4C9f09C289C8ba

## Why it needs GenLayer

A prediction market must decide a real-world question from sources no single node can be trusted to read honestly. GenLayer validators independently fetch the cited web sources and must reach comparative consensus on the same outcome, so the verdict is trustless and reproducible, not the opinion of one oracle.

## What v0.3.0 hardens

Earlier versions produced a verdict but did not bind it to a verifiable record or consume it in a consequential workflow. v0.3.0 fixes exactly that:

1. Verifiable market record. The market is created with an immutable `market_id`, and the contract stores `question_hash` and `rules_hash` (SHA-256 of the exact question and resolution rules). Anyone can call `verify_question(q)` / `verify_rules(r)` to prove the text the verdict was based on has not been altered. The outcome is bound to this record, not to free-floating text.
2. Consequential settlement workflow. The verdict is consumed by real economic paths, not just displayed: `stake(side, amount)` records YES/NO positions in an on-chain ledger; `resolve()` runs validator consensus and sets the outcome; `settle()` locks the winning side once the outcome is YES/NO; `claim()` pays parimutuel winnings.
3. Appeal / dispute path with real consequence. `dispute(reason)` freezes a resolved market and forces re-resolution; `resolve_dispute()` re-runs consensus and records `dispute_outcome = OVERTURNED` (verdict changed) or `UPHELD` (verdict stood). Disputes are bounded (max 2) and every round is appended to an on-chain audit trail.
4. Prompt-injection defense. Source text and disputant context are wrapped as untrusted data; the resolver treats any embedded instructions as data, ignores failed fetches, and only answers YES/NO/UNRESOLVED from genuine evidence.

## Payout math

Settlement is parimutuel: winners split the whole pool in proportion to their winning stake.

    payout = your_winning_stake * total_pool / winning_pool

Example: YES pool 100, NO pool 50, total 150, outcome YES. A YES staker of 100 claims 100 * 150 / 100 = 150.

## Lifecycle

    open --stake--> open --resolve--> resolved --settle--> settled --claim--> paid
                                          |   ^
                                    dispute   resolve_dispute
                                          v   |
                                       disputed

## Contract API

Views:
- `get_state()` returns full market state plus computed `yes_pool` / `no_pool` / `total_pool`.
- `verify_question(q)` / `verify_rules(r)` return True if the SHA-256 matches the stored record.

Writes:
- `add_source(url)` creator only, while open.
- `stake(side, amount)` "YES" or "NO", while open.
- `resolve()` open to resolved via validator consensus.
- `dispute(reason)` resolved to disputed (max 2).
- `resolve_dispute()` creator, disputed to resolved, sets OVERTURNED/UPHELD.
- `settle()` creator, resolved (YES/NO) to settled, locks winning side.
- `claim()` settled, pays parimutuel winnings to a winning staker.

## Consensus resolver

`resolve()` fetches each cited source with `gl.nondet.web.render`, builds a neutral decision prompt (question + rules + evidence), and runs it under `gl.eq_principle.prompt_comparative` so independent validators must agree on the final outcome value (YES / NO / UNRESOLVED). Wording or which sources loaded may differ; only the outcome must match.

## Deployments

| Version | Address | Notes |
| --- | --- | --- |
| v0.3.0 | 0x86d36795b66c29A7445945585a4C9f09C289C8ba | market record + stake/settle/claim + dispute |
| v0.2.0 | 0x5853abFE0CBF83ac65cd3DACFB35Bb1B0314C969 | resolve + dispute |

## Run it

Set your key in `.env` (never commit it):

    PRIVATE_KEY=0x...

Deploy and run the full demo:

    node --env-file=.env deploy.mjs
    node --env-file=.env run.mjs

`run.mjs` is idempotent and resumable: it stakes YES and NO, resolves, disputes, resolves the dispute, settles, and claims, retrying through testnet rate limits and skipping already-completed steps.

## Tests

`test.mjs` exercises the lifecycle and guard rails (staking only while open, dispute limits, creator-only settle, parimutuel math).
