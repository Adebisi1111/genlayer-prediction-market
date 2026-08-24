"""Canonical tests for contracts/factory.py.

Covers what the steward asked for:
  1. resolution comes from the cited source via validator consensus (mocked web+LLM)
  2. YES/NO stake validation
  3. GEN actually transferred to winners
  4. repeat claims prevented
  5. both YES and NO can win (outcome is not hardcoded)
"""

SRC = "https://example.com/btc-price"


def _hex(account) -> str:
    """Direct-mode fixtures are raw 20-byte addresses; the contract stores the
    EIP-55 checksummed hex that Address.as_hex produces, so match that casing."""
    raw = bytes(account) if isinstance(account, (bytes, bytearray)) else None
    if raw is None:
        return str(account)
    from genlayer.py.types import Address

    return Address(raw).as_hex


def _open_market(contract, direct_vm, direct_alice, question="Will BTC exceed $100k?"):
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    return contract.createMarket(question, SRC)


def _mock_source(direct_vm, page_text, verdict):
    """Validators fetch the cited URL, then judge it with an LLM."""
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*example\.com.*", {"status": 200, "body": page_text})
    direct_vm.mock_llm(r".*prediction market.*", verdict)


# --- 1. resolution from cited sources through consensus -------------------


def test_resolve_reads_cited_source_and_yields_yes(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/factory.py")
    mid = _open_market(contract, direct_vm, direct_alice)

    # The source URL is stored on-chain and is what validators will read.
    assert contract.getSource(mid) == SRC

    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")
    direct_vm.sender = direct_bob
    direct_vm.value = int(1e18)
    contract.stake(mid, "NO")

    _mock_source(direct_vm, "Bitcoin closed at $104,200 today.", "YES")
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    assert contract.resolve(mid) == "YES"
    assert "RESOLVED" in contract.getMarket(mid)


def test_resolve_yields_no_when_source_says_so(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """Outcome must follow the evidence -- NOT hardcoded YES (the v15 bug)."""
    contract = direct_deploy("contracts/factory.py")
    mid = _open_market(contract, direct_vm, direct_alice)

    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")
    direct_vm.sender = direct_bob
    direct_vm.value = int(1e18)
    contract.stake(mid, "NO")

    _mock_source(direct_vm, "Bitcoin closed at $61,000 today.", "NO")
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    assert contract.resolve(mid) == "NO"
    assert "|NO|" in contract.getMarket(mid)


def test_inconclusive_source_leaves_market_open(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy("contracts/factory.py")
    mid = _open_market(contract, direct_vm, direct_alice)
    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")

    _mock_source(direct_vm, "This page is about cooking recipes.", "UNKNOWN")
    direct_vm.value = 0
    with direct_vm.expect_revert("Source does not settle this question yet"):
        contract.resolve(mid)
    assert "OPEN" in contract.getMarket(mid)


def test_market_requires_source_url(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/factory.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert("Source URL required"):
        contract.createMarket("Will BTC moon?", "not-a-url")


# --- 2. YES/NO stake validation ------------------------------------------


def test_stake_rejects_invalid_side(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/factory.py")
    mid = _open_market(contract, direct_vm, direct_alice)
    direct_vm.value = int(1e18)
    with direct_vm.expect_revert("Side must be YES or NO"):
        contract.stake(mid, "MAYBE")


def test_stake_requires_value(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/factory.py")
    mid = _open_market(contract, direct_vm, direct_alice)
    direct_vm.value = 0
    with direct_vm.expect_revert("Must send GEN"):
        contract.stake(mid, "YES")


def test_cannot_stake_after_resolution(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/factory.py")
    mid = _open_market(contract, direct_vm, direct_alice)
    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")

    _mock_source(direct_vm, "Bitcoin closed at $104,200.", "YES")
    direct_vm.value = 0
    contract.resolve(mid)

    direct_vm.value = int(1e18)
    with direct_vm.expect_revert("Market not open"):
        contract.stake(mid, "NO")


# --- 3. GEN transferred to winners + 4. repeat claims prevented ----------


def test_winner_paid_parimutuel_and_cannot_claim_twice(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/factory.py")
    mid = _open_market(contract, direct_vm, direct_alice)

    # alice 1 GEN YES, bob 1 GEN NO -> pool 2 GEN, YES wins -> alice gets all 2
    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")
    direct_vm.sender = direct_bob
    direct_vm.value = int(1e18)
    contract.stake(mid, "NO")

    _mock_source(direct_vm, "Bitcoin closed at $104,200.", "YES")
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    contract.resolve(mid)
    contract.settle(mid)

    assert contract.previewPayout(mid, _hex(direct_alice)) == str(int(2e18))
    assert contract.isClaimed(mid, _hex(direct_alice)) == "0"

    payout = contract.claim(mid)
    assert int(payout) == int(2e18)
    assert contract.isClaimed(mid, _hex(direct_alice)) == "1"

    with direct_vm.expect_revert("Already claimed"):
        contract.claim(mid)


def test_loser_cannot_claim(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/factory.py")
    mid = _open_market(contract, direct_vm, direct_alice)

    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")
    direct_vm.sender = direct_bob
    direct_vm.value = int(1e18)
    contract.stake(mid, "NO")

    _mock_source(direct_vm, "Bitcoin closed at $104,200.", "YES")
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    contract.resolve(mid)
    contract.settle(mid)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("No winning stake"):
        contract.claim(mid)


def test_no_side_winner_is_paid(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The NO side must be payable too -- v15 only ever paid YES."""
    contract = direct_deploy("contracts/factory.py")
    mid = _open_market(contract, direct_vm, direct_alice)

    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")
    direct_vm.sender = direct_bob
    direct_vm.value = int(1e18)
    contract.stake(mid, "NO")

    _mock_source(direct_vm, "Bitcoin closed at $61,000.", "NO")
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    contract.resolve(mid)
    contract.settle(mid)

    direct_vm.sender = direct_bob
    assert int(contract.claim(mid)) == int(2e18)


def test_multiple_stakes_by_same_wallet_all_count(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """Two YES stakes from one wallet must both be paid, not just the first."""
    contract = direct_deploy("contracts/factory.py")
    mid = _open_market(contract, direct_vm, direct_alice)

    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")
    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")  # same wallet, second entry
    direct_vm.sender = direct_bob
    direct_vm.value = int(2e18)
    contract.stake(mid, "NO")

    _mock_source(direct_vm, "Bitcoin closed at $104,200.", "YES")
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    contract.resolve(mid)
    contract.settle(mid)

    # alice staked 2 of the 2 winning GEN; pool is 4 -> she takes all 4.
    assert int(contract.claim(mid)) == int(4e18)


def test_claim_requires_settled(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/factory.py")
    mid = _open_market(contract, direct_vm, direct_alice)
    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")

    _mock_source(direct_vm, "Bitcoin closed at $104,200.", "YES")
    direct_vm.value = 0
    contract.resolve(mid)

    # RESOLVED but not SETTLED yet
    with direct_vm.expect_revert("Not settled"):
        contract.claim(mid)
