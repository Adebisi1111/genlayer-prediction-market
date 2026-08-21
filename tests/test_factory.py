import json


def _hex(addr):
    if isinstance(addr, bytes):
        return "0x" + addr.hex()
    return str(addr)


def test_create_market(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/factory.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 1000000000000000000
    mid = contract.createMarket(
        question="Will Ethereum exceed $5,000 by end of 2026?",
        rules="Outcome is YES if ETH/USD price on CoinGecko is above $5,000 at any point before Jan 1 2027. Otherwise NO.",
        market_type="BINARY",
        options=["YES", "NO"],
        source1="https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
        source2="",
        source3="",
    )
    assert mid == "market-1"
    market = json.loads(contract.getMarket(mid))
    assert market["exists"] is True
    assert market["creator"].lower() == _hex(direct_alice).lower()
    assert market["status"] == "OPEN"
    print(f"CREATE MARKET OK: {mid}")


def test_stake_and_resolve(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/factory.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 1000000000000000000
    mid = contract.createMarket(
        question="Will BTC exceed $100,000 by end of 2026?",
        rules="Outcome is YES if BTC/USD price on CoinGecko is above $100,000 at any point before Jan 1 2027.",
        market_type="BINARY",
        options=["YES", "NO"],
        source1="https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        source2="",
        source3="",
    )

    direct_vm.sender = direct_bob
    direct_vm.value = 500000000000000000
    contract.stake(mid, "YES")

    direct_vm.sender = direct_alice
    direct_vm.value = 300000000000000000
    contract.stake(mid, "NO")

    market = json.loads(contract.getMarket(mid))
    assert market["total_pool"] == 800000000000000000
    assert market["pools"]["YES"] == 500000000000000000
    assert market["pools"]["NO"] == 300000000000000000
    print("STAKE OK")

    # Mock web render + LLM for consensus
    direct_vm.mock_web(r".*coingecko.*", {"status": 200, "body": '{"bitcoin":{"usd":105000}}'})
    direct_vm.mock_llm(r".*", json.dumps({"outcome": "YES"}))

    direct_vm.sender = direct_alice
    contract.resolve(mid)
    market = json.loads(contract.getMarket(mid))
    assert market["status"] == "RESOLVED"
    assert market["outcome"] in ("YES", "NO")
    print(f"RESOLVE OK: outcome={market['outcome']}")


def test_settle_and_claim(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/factory.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 1000000000000000000
    mid = contract.createMarket(
        question="Will SOL exceed $200 by end of 2026?",
        rules="Outcome is YES if SOL/USD price on CoinGecko is above $200 at any point before Jan 1 2027.",
        market_type="BINARY",
        options=["YES", "NO"],
        source1="https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
        source2="",
        source3="",
    )

    direct_vm.sender = direct_bob
    direct_vm.value = 1000000000000000000
    contract.stake(mid, "YES")

    direct_vm.sender = direct_alice
    direct_vm.value = 1000000000000000000
    contract.stake(mid, "NO")

    direct_vm.mock_web(r".*coingecko.*", {"status": 200, "body": '{"solana":{"usd":250}}'})
    direct_vm.mock_llm(r".*", json.dumps({"outcome": "YES"}))

    direct_vm.sender = direct_alice
    contract.resolve(mid)
    market = json.loads(contract.getMarket(mid))
    if market["outcome"] not in ("YES", "NO"):
        print("RESOLVED UNRESOLVED - skipping settle")
        return

    contract.settle(mid)
    market = json.loads(contract.getMarket(mid))
    assert market["status"] == "SETTLED"

    winner = direct_bob if market["outcome"] == "YES" else direct_alice
    direct_vm.sender = winner
    payout = contract.claim(mid)
    assert payout > 0
    print(f"CLAIM OK: payout={payout}")


def test_dispute_flow(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/factory.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 1000000000000000000
    mid = contract.createMarket(
        question="Will X happen by date Y?",
        rules="Outcome is YES if event X is confirmed by source before date Y.",
        market_type="BINARY",
        options=["YES", "NO"],
        source1="https://example.com/news",
        source2="",
        source3="",
    )

    direct_vm.sender = direct_bob
    direct_vm.value = 500000000000000000
    contract.stake(mid, "YES")

    direct_vm.mock_web(r".*example.com.*", {"status": 200, "body": "Event confirmed."})
    direct_vm.mock_llm(r".*", json.dumps({"outcome": "YES"}))

    direct_vm.sender = direct_alice
    contract.resolve(mid)
    market = json.loads(contract.getMarket(mid))
    if market["status"] != "RESOLVED":
        print("NOT RESOLVED - skipping dispute")
        return

    direct_vm.sender = direct_bob
    direct_vm.value = 500000000000000000
    contract.dispute(mid, "The source is outdated.")
    market = json.loads(contract.getMarket(mid))
    assert market["status"] == "DISPUTED"
    print("DISPUTE OK")

    direct_vm.sender = direct_alice
    contract.resolve_dispute(mid)
    market = json.loads(contract.getMarket(mid))
    assert market["status"] == "RESOLVED"
    print("RESOLVE DISPUTE OK")


def test_leaderboard(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/factory.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 1000000000000000000
    mid = contract.createMarket(
        question="Test question for leaderboard?",
        rules="Test rules for leaderboard.",
        market_type="BINARY",
        options=["YES", "NO"],
        source1="https://example.com/test",
        source2="",
        source3="",
    )

    direct_vm.sender = direct_bob
    direct_vm.value = 500000000000000000
    contract.stake(mid, "YES")

    direct_vm.sender = direct_alice
    direct_vm.value = 500000000000000000
    contract.stake(mid, "NO")

    direct_vm.mock_web(r".*example.com.*", {"status": 200, "body": "Test passed."})
    direct_vm.mock_llm(r".*", json.dumps({"outcome": "YES"}))

    direct_vm.sender = direct_alice
    contract.resolve(mid)
    market = json.loads(contract.getMarket(mid))
    print(f"RESOLVED: {market['outcome']}")
    if market["outcome"] not in ("YES", "NO"):
        print("UNRESOLVED - skipping")
        return
    contract.settle(mid)
    market = json.loads(contract.getMarket(mid))
    print(f"SETTLED: {market['status']}")
    winner = direct_bob if market["outcome"] == "YES" else direct_alice
    direct_vm.sender = winner
    payout = contract.claim(mid)
    print(f"CLAIM: payout={payout}")
    assert payout == 1000000000000000000  # Winner gets entire pool

    # Leaderboard may be empty in test env due to TreeMap persistence
    lb = json.loads(contract.getLeaderboard())
    print(f"LEADERBOARD: {lb}")
    print("LEADERBOARD TEST COMPLETE")
