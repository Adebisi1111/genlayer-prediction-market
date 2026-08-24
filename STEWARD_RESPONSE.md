One canonical contract: contracts/factory.py. 40+ earlier iterations moved to contracts/archive/; stale gl-client.v2/v3/v4 (dead address) deleted. Every page uses one client at one address.

resolve(market_id) no longer takes or hardcodes an outcome. createMarket(question, source_url) requires a cited source stored on-chain; resolve() fetches it via gl.nondet.web.render, judges with gl.nondet.exec_prompt, and agrees through gl.eq_principle.prompt_comparative. No admin setter. UNKNOWN reverts, leaving the market OPEN.

Lifecycle verified on Studio: resolve() returned "YES" from the cited source, settle, previewPayout 1.0 GEN, claim paid 1.0 GEN, isClaimed=1, repeat claim reverted "Already claimed". stake() rejects any side but YES/NO.

claim() sends native GEN via @gl.evm.contract_interface. Confirmed on Bradbury: contract 2.1 -> 1.1 GEN, Finalized.

tests/test_factory.py: 12 passing — YES/NO outcomes, UNKNOWN, missing source, invalid side, payout math, repeat and loser claims.
