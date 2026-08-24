# PrimeX — GenLayer Prediction Market Factory

A factory contract that spawns prediction markets on GenLayer Bradbury. Every market cites a **source URL** on-chain, and resolution is performed by GenLayer validators who each independently fetch that source, judge the question against it with an LLM, and agree through comparative consensus. Traders stake GEN on YES or NO; winners are paid native GEN parimutuel-style.

- **Canonical contract:** `contracts/factory.py` (the only contract; earlier iterations are in `contracts/archive/` for history)
- **Deployed (Bradbury):** `0x1Ac72Bd0Ff333bC20082c83E9DEa23d7ED6da889`
- **Explorer:** https://explorer-bradbury.genlayer.com/address/0x1Ac72Bd0Ff333bC20082c83E9DEa23d7ED6da889
- **Live app:** https://adebisi1111.github.io/genlayer-prediction-market/

## Why it needs GenLayer

A prediction market has to decide real-world questions from sources no single node can be trusted to read honestly. In `resolve()` the contract calls `gl.nondet.web.render()` on the market's cited URL and `gl.nondet.exec_prompt()` to judge it, wrapped in `gl.eq_principle.prompt_comparative()`. Each validator runs that itself and the network reconciles the verdicts, so the outcome is the network's judgment of the evidence — not an oracle's, and not the caller's. No other chain does this natively.

The contract has no admin outcome setter. `resolve()` takes only a market ID; the verdict comes from the source.

## Lifecycle

1. **`createMarket(question, source_url)`** — the source URL is mandatory and validated; it is the evidence validators will read.
2. **`stake(id, side)`** — GEN on `YES` or `NO`. Anything else reverts. Parimutuel odds move with the pool.
3. **`resolve(id)`** — validators fetch the cited source, an LLM judges it, comparative consensus decides `YES` or `NO`. If the source doesn't settle the question, validators return `UNKNOWN`, the call reverts, and the market stays `OPEN` for a later attempt.
4. **`settle(id)`** — locks the resolved outcome and opens claims.
5. **`claim(id)`** — pays the winner's parimutuel share in native GEN, once per wallet per market.

## Payout math

```
payout = your_winning_stake × total_pool ÷ winning_pool
```

Winners split the entire pool in proportion to their winning stake. Multiple stakes from the same wallet are all counted. Example: YES pool 1.0, NO pool 0.4, total 1.4 GEN, outcome YES → a 1.0 YES staker claims 1.4 GEN.

## Paying an EOA: the part that is easy to get wrong

GenLayer has two distinct transfer mechanisms, and using the wrong one loses funds **silently**:

| Recipient | Message type | API |
|---|---|---|
| Another Intelligent Contract | internal | `gl.get_contract_at(addr).emit_transfer(...)` |
| **A wallet (EOA)** | **external, via ghost contract** | **`@gl.evm.contract_interface`** |

`gl.get_contract_at(wallet).emit_transfer()` against an EOA returns `FINISHED_WITH_RETURN`, is accepted by consensus, and moves **zero wei** — no error anywhere. This contract therefore declares an `@gl.evm.contract_interface` payee and calls `_Payee(addr).emit_transfer(value=...)`. External messages execute **on finalization**, which on Bradbury is ~59 minutes after the last validator vote (`validUntil − LastVote` in the raw receipt), so a claim sitting at `Accepted` for that long is the protocol working as designed.

`claim()` marks the claim before emitting the transfer, so a failed external message reverts the whole call and the claim stays available rather than being consumed.

## Contract API

Views (free):
- `getConfig()` — market count
- `getMarket(id)` — `question|status|outcome|pool|positions|source_url`
- `getSource(id)` — the cited source URL
- `previewPayout(id, user)` — exact payout the contract will pay, in wei
- `isClaimed(id, user)` — `"1"` once claimed, so the UI can hide dead claims

Writes:
- `createMarket(question, source_url)`
- `stake(id, side)` — payable, `YES` or `NO`
- `resolve(id)` — validator consensus over the cited source
- `settle(id)`
- `claim(id)`

## Run it

```bash
# Lint
genvm-lint check contracts/factory.py

# Test (12 tests, in-memory, web + LLM mocked)
pytest tests/test_factory.py -q

# Deploy
genlayer deploy --contract contracts/factory.py

# Serve the frontend
cd public && python3 -m http.server 8099
```

## Tests

`tests/test_factory.py` — 12 direct-mode tests, all passing:

**Resolution from cited sources**
- resolves `YES` when the mocked source supports it
- resolves `NO` when the source supports that instead (the outcome is not hardcoded)
- leaves the market `OPEN` when validators return `UNKNOWN`
- rejects market creation without a valid source URL

**Stake validation**
- rejects sides other than `YES`/`NO`
- rejects zero-value stakes
- rejects staking after resolution

**Payout and claims**
- winner is paid the full parimutuel amount; `previewPayout` matches
- repeat claim reverts `Already claimed`
- loser reverts `No winning stake`
- a `NO`-side winner is paid
- multiple stakes from one wallet are all counted
- claiming before `settle()` reverts

Frontend checks: `node wallet_test.mjs`, `node test_rewards.mjs`, `node test_toggle.mjs`

## Verified on Bradbury

**Payouts — fully proven.** A `claim()` on a settled market moved exactly 1.0 GEN to the winner's wallet:

| | Before | After |
|---|---|---|
| Contract balance | 2.1 GEN | **1.1 GEN** |
| Winner wallet | 60.4764 | **60.3743** (net of parallel gas) |
| Tx status | `Accepted` | **`Finalized`** (statusCode 7) after 18 min |

EOA payouts are external messages, so they execute at finalization. `Accepted` means consensus committed the payout; the balance moves when the window closes.

**Consensus resolution — executes, agreement still being verified.** Validators do run the nondeterministic block on Bradbury: a leader's raw output decoded from receipt `0x4c96c44c…1499` as the verdict `NO`, proving `web.render` + `exec_prompt` execute under real consensus. However, no market has yet reached `RESOLVED` on-chain — rounds have exhausted leader rotations without a reveal. The logic is covered by 12 passing direct-mode tests with web and LLM mocked; on-chain agreement on Bradbury is still being confirmed.

Two things learned while diagnosing this, both now reflected in the code:
- `prompt_comparative` needs the *judged input* to be stable across validators. Slicing a raw prefix of a large, frequently-edited page starves it of agreement, so `resolve()` filters the source to lines matching the question's key terms.
- `prompt_non_comparative` pipes the leader's output through a second LLM template, so its return is prose rather than the bare verdict token. It is the wrong primitive for a strict YES/NO/UNKNOWN answer.
