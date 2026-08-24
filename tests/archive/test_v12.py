import pytest
import sys
sys.path.insert(0, "..")

def test_flow(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/factory_v12.py")
    direct_vm.sender = direct_alice
    
    # Create
    mid = contract.createMarket("Will Bitcoin exceed $100,000?")
    print(f"Created: {mid}")
    
    # Stake
    direct_vm.value = 1000000000000000000
    contract.stake(mid, "YES")
    
    # Resolve + Settle
    direct_vm.value = 0
    contract.resolve(mid)
    contract.settle(mid)
    
    # Claim
    payout = contract.claim(mid)
    print(f"Payout: {payout}")
    
    # Read
    market = contract.getMarket(mid)
    print(f"Market: {market}")
