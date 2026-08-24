**Bradbury: `gl.nondet.web.render()` never reaches consensus — LLM calls in the same contract work fine**

Web access inside an equivalence-principle block appears to be non-functional on testnet-bradbury. LLM access on the same contract, in the same minute, works. Is web fetch currently disabled for Bradbury validators, or am I missing a requirement?

**Isolation probe** — one contract, three methods, each exercising a single primitive:
`0xd4a87E827B8fA2C65225afAD6c44cB404D9da940`

| Method | Primitive | Result |
|---|---|---|
| `web_strict` | `gl.nondet.web.render("https://example.com", mode="text")` + `strict_eq` | **`NOT_VOTED`** — 0/5 validators commit, `eqBlocksOutputs` empty, no state write |
| `llm_strict` | `gl.nondet.exec_prompt(...)` + `strict_eq` | `FINISHED_WITH_RETURN`, wrote `YES` in ~30s |
| `llm_comparative` | `gl.nondet.exec_prompt(...)` + `prompt_comparative` | `FINISHED_WITH_RETURN`, wrote `YES` in ~30s |

**Transactions** (web fails, LLM succeeds, run back to back):
- web `NOT_VOTED`: `0x7b89e25f677c231d79151defbf3baeeff47c744ccb9b55bbc34b576735e9d31c`
- web `NOT_VOTED` (retry): `0x46cd349ea8051583dba7607279c23b47899dc1f1010221c4bdd0a0339e7d2432`
- llm OK: `0x04b00cfed5bb58e0d34c0e2ed68c4a014cdcb7d72368f9fb9ffeeddba4fa7fb7`
- llm OK (retry): `0x8875e2eec7e10c79dbd77891b70e1563656d8a17e8fdf560cee5a1dee96a7a23`
- llm comparative OK: `0x44800b9135143f08cb59a41e17221206da116ba948f25f0b907b7cb657b683e6`

**Probe contract:**

```python
@gl.public.write
def web_strict(self) -> str:
    def f() -> str:
        page = gl.nondet.web.render("https://example.com", mode="text")
        return "HIT" if "Example" in page else "MISS"
    out = gl.eq_principle.strict_eq(f)
    self.log["web_strict"] = str(out)
    return str(out)
```

Nothing exotic — `example.com`, `mode="text"`, `strict_eq`, single return value.

**In a real contract** (prediction market resolving from a cited source URL) the same call stalls in leader rotation: rounds reach 4 `votesCommitted` / **0 `votesRevealed`**, then rotate until rotations are exhausted. Tried both a large page (Wikipedia) and a small immutable one (`bitcoin.org/bitcoin.pdf`), and both `prompt_comparative` and `strict_eq` — identical stall, so it isn't input drift or the choice of equivalence principle.

Contract: `0x1Ac72Bd0Ff333bC20082c83E9DEa23d7ED6da889`
Stalled resolve: `0x560817e953cde48347aacac76def02901fdb39c46bbc4a910cac20ea7d677fa1`
Earlier stalled resolve (leader output decoded from `eqBlocksOutputs` as the verdict `NO`, so the block *does* execute): `0x4c96c44c7da1374fa0faa1c549afaf7f647ab9a7b2fbf9f8165cd35f9f7f1499`

**Questions:**
1. Is `gl.nondet.web.*` currently available on Bradbury validators, or disabled/unprovisioned?
2. Is there an allowlist, header, or `mode` requirement for outbound fetches I'm missing?
3. Should web-sourced resolution be tested on Asimov or Studio instead for now?

Runner: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`
Repo: https://github.com/Adebisi1111/genlayer-prediction-market
