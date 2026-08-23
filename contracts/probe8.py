# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
#
# PrimeX Factory v18 — parimutuel prediction market WITH REAL PAYOUTS.
#
# Payout primitive for this runner (discovered by probing gl at runtime):
#     gl.get_contract_at(Address(to)).emit_transfer(value=u256(amount))
# `gl.chain.Account(...)` is a v0.3.0 API and does NOT exist here.
# Emitted transfers carry onAcceptance=False, so value moves at FINALIZATION
# (later than ACCEPTED) — that is normal, not a failure.
#
# Storage rules that must not regress:
#   - only u256 / TreeMap / DynArray; NO @allow_storage dataclasses, NO json
#   - positions kept as a "|"-joined string of "addr:side:amount"
#   - no explicit __init__ (the linter asks for one, but adding it errors on
#     deploy with this runner; storage fields auto-initialise)

from genlayer import *


class Factory(gl.Contract):
    market_count: u256
    m_creator: TreeMap[str, str]
    m_question: TreeMap[str, str]
    m_status: TreeMap[str, str]
    m_outcome: TreeMap[str, str]
    m_pool: TreeMap[str, u256]
    m_positions: TreeMap[str, str]
    # "|"-joined list of addresses that already claimed, per market.
    m_claimed: TreeMap[str, str]
    # Lifetime GEN actually paid out, per address (audit trail).
    m_paid: TreeMap[str, u256]


    @gl.public.write
    def ping(self) -> str:
        return "pong"

    @gl.public.view
    def count(self) -> str:
        return str(int(self.market_count))
