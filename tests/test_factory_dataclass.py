import pytest
import sys
sys.path.insert(0, "..")

def test_create_market(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/factory_dataclass.py")
    direct_vm.sender = direct_alice
    
    mid = contract.createMarket("Will Bitcoin exceed $100,000?", "Rules here", "BINARY", ["YES", "NO"], "https://example.com", "", "")
    assert mid == "market-1"
    
    market = contract.getMarket("market-1")
    print(f"Market: {market}")

def test_stake_and_claim(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/factory_dataclass.py")
    direct_vm.sender = direct_alice
    
    mid = contract.createMarket("Will Bitcoin exceed $100,000?", "Rules here", "BINARY", ["YES", "NO"], "https://example.com", "", "")
    
    # Stake
    direct_vm.sender = direct_alice
    direct_vm.value = 1000000000000000000
    contract.stake(mid, "YES")
    
    # Settle
    direct_vm.value = 0
    contract.resolve(mid)
    contract.settle(mid)
    
    # Claim
    payout = contract.claim(mid)
    print(f"Payout: {payout}")
    assert payout > 0
