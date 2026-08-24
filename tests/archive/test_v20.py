import pytest
import sys
sys.path.insert(0, "..")

def test_full_lifecycle_yes_winner(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Full lifecycle: create, stake YES+NO, resolve, settle, claim."""
    contract = direct_deploy("contracts/factory_v20.py")
    
    # Create
    direct_vm.sender = direct_alice
    mid = contract.createMarket("Will BTC > $100k?")
    
    # Stake YES (alice)
    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")
    
    # Stake NO (bob)
    direct_vm.sender = direct_bob
    direct_vm.value = int(0.4e18)
    contract.stake(mid, "NO")
    
    # Resolve + Settle
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    contract.resolve(mid)
    contract.settle(mid)
    
    # Claim YES winner
    payout = contract.claim(mid)
    assert payout > 0
    
    # Verify market state
    market = contract.getMarket(mid)
    assert "SETTLED" in market

def test_no_winner_claim_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    """NO staker cannot claim when outcome is YES."""
    contract = direct_deploy("contracts/factory_v20.py")
    
    direct_vm.sender = direct_alice
    mid = contract.createMarket("Test")
    
    # Stake YES
    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")
    
    # Stake NO
    direct_vm.sender = direct_bob
    direct_vm.value = int(0.4e18)
    contract.stake(mid, "NO")
    
    # Resolve YES
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    contract.resolve(mid)
    contract.settle(mid)
    
    # Bob (NO staker) tries to claim - should fail
    direct_vm.sender = direct_bob
    try:
        contract.claim(mid)
        raise AssertionError("Expected revert for non-winner claim")
    except Exception as e:
        assert "No winning stake" in str(e)

def test_repeat_claim_prevented(direct_vm, direct_deploy, direct_alice):
    """Same wallet cannot claim twice."""
    contract = direct_deploy("contracts/factory_v20.py")
    
    direct_vm.sender = direct_alice
    mid = contract.createMarket("Test")
    
    # Stake YES
    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")
    
    # Resolve + Settle
    direct_vm.value = 0
    contract.resolve(mid)
    contract.settle(mid)
    
    # First claim succeeds
    payout = contract.claim(mid)
    assert payout > 0
    
    # Second claim fails
    try:
        contract.claim(mid)
        raise AssertionError("Expected revert for repeat claim")
    except Exception as e:
        assert "Already claimed" in str(e)

def test_both_sides_stake_and_resolve(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Both YES and NO can be staked and the market resolves correctly."""
    contract = direct_deploy("contracts/factory_v20.py")
    
    direct_vm.sender = direct_alice
    mid = contract.createMarket("Test")
    
    # Alice stakes YES
    direct_vm.value = int(1e18)
    contract.stake(mid, "YES")
    
    # Bob stakes NO
    direct_vm.sender = direct_bob
    direct_vm.value = int(1e18)
    contract.stake(mid, "NO")
    
    # Both sides have stake
    market = contract.getMarket(mid)
    assert "YES" in market
    assert "NO" in market
    
    # Resolve
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    contract.resolve(mid)
    
    market = contract.getMarket(mid)
    assert "RESOLVED" in market
