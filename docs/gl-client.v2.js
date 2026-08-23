// PrimeX — GenLayer client wrapper for the browser.
//
// ─────────────────────────────────────────────────────────────────────────────
// HARD-WON LESSONS. Do not "simplify" these away — each one cost a debug cycle.
//
//  1. GenLayer contracts are NOT EVM contracts. You cannot reach them with
//     ethers.Contract or viem writeContract pointed at the contract address.
//     Calls must be routed through the ConsensusMain contract, which
//     genlayer-js does for you. Sending an ABI-encoded tx straight to the
//     contract address yields "EVM tx succeeded but no NewTransaction event"
//     (or a silent revert) and NOTHING lands on chain. This was the real cause
//     of "no transaction is going through".
//
//  2. Always import the official chain export (testnetBradbury). Do NOT build
//     a chain object like {...studionet, id: 4221} — that keeps Studio's
//     consensusMainContract address and every tx reverts.
//
//  3. `value` is the GEN forwarded to the contract (gl.message.value).
//     Non-payable methods MUST receive value: 0n or the consensus contract
//     reverts. Only `stake` takes a non-zero value.
//
//  4. The genlayer CLI's `--fee-value` is a FEE DEPOSIT, not the call value —
//     it always sends value: 0n. That is why CLI stake calls always hit the
//     "Must send GEN" guard. Use writeContract({ value }) instead.
//
//  5. Reads go through client.readContract. A plain eth_call fails.
//
//  6. getMarket() returns "question|status|outcome|poolWei|positions" and
//     positions are joined with "|" in the deployed v15 contract, so parse
//     defensively: take the first 4 fields, treat the remainder as positions.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/genlayer-js@1.1.8';
import { testnetBradbury } from 'https://esm.sh/genlayer-js@1.1.8/chains';

export const FACTORY = '0xF8bf266694Cc729d9e1032e9dA244febfE10b335';
export const RPC_URL = 'https://rpc-bradbury.genlayer.com';
export const EXPLORER_TX = 'https://explorer-bradbury.genlayer.com/tx/';
export const EXPLORER_ADDR = 'https://explorer-bradbury.genlayer.com/address/';
export const CHAIN_ID_HEX = '0x107d'; // 4221

let client = null;
let address = null;

export const getAddress = () => address;
export const isConnected = () => !!client && !!address;

/** Read-only client that works with no wallet attached. */
function publicClient() {
  return createClient({ chain: testnetBradbury });
}

async function ensureChain() {
  const current = await window.ethereum.request({ method: 'eth_chainId' });
  if (current === CHAIN_ID_HEX) return;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err) {
    if (err && (err.code === 4902 || err.code === -32603)) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: CHAIN_ID_HEX,
          chainName: 'GenLayer Bradbury Testnet',
          nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
          rpcUrls: ['https://rpc-bradbury.genlayer.com'],
          blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
        }],
      });
    } else {
      throw err;
    }
  }
}

export async function connect() {
  if (!window.ethereum) throw new Error('No wallet detected. Open this page in MetaMask or Rabby.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts || !accounts.length) throw new Error('No account authorised.');
  await ensureChain();
  address = accounts[0];
  // IMPORTANT: pass the ADDRESS plus the injected provider.
  // Do NOT use createAccount(address) — createAccount takes a PRIVATE KEY and
  // throws "invalid private key, expected hex or 32 bytes, got string" on an
  // address. Browser wallets sign via `provider`, so no key is ever exposed.
  client = createClient({
    chain: testnetBradbury,
    account: address,
    provider: window.ethereum,
  });
  return address;
}

export function disconnect() { client = null; address = null; }

export async function read(functionName, args = []) {
  const c = client ?? publicClient();
  return c.readContract({ address: FACTORY, functionName, args });
}

/**
 * State-changing call.
 * @param {string} genAmount decimal GEN forwarded to the contract ('0' if non-payable)
 * @returns {Promise<{hash:string, exec:string}>}
 */
export async function write(functionName, args = [], genAmount = '0') {
  if (!client) throw new Error('Connect your wallet first.');
  const value = BigInt(Math.round(parseFloat(genAmount || '0') * 1e18));
  const hash = await client.writeContract({ address: FACTORY, functionName, args, value });
  const receipt = await client.waitForTransactionReceipt({ hash, retries: 100, interval: 5000 });
  let lr = receipt?.consensus_data?.leader_receipt;
  if (Array.isArray(lr)) lr = lr[0];
  const exec = receipt?.txExecutionResultName ?? lr?.execution_result;
  if (exec !== 'FINISHED_WITH_RETURN') {
    throw new Error(`Transaction did not finish cleanly (${exec ?? 'unknown'}). Nothing was changed.`);
  }
  return { hash, exec };
}

export async function getBalance() {
  if (!address) return 0;
  const wei = await window.ethereum.request({ method: 'eth_getBalance', params: [address, 'latest'] });
  return Number(BigInt(wei)) / 1e18;
}

const weiToGen = (w) => Number(BigInt(w || '0')) / 1e18;

/** Parse "question|status|outcome|poolWei|positions..." defensively. */
export function parseMarket(id, raw) {
  if (!raw || raw === 'NOT_FOUND') return null;
  const parts = String(raw).split('|');
  const question = parts[0] ?? '';
  const status = parts[1] ?? '';
  const outcome = parts[2] ?? '';
  const pool = weiToGen(parts[3] || '0');
  // Positions occupy every remaining segment (v15 joins them with '|').
  const positions = parts.slice(4).filter(Boolean);

  let yes = 0, no = 0;
  const holders = [];
  for (const p of positions) {
    const seg = p.split(':');
    if (seg.length < 3) continue;
    const gen = weiToGen(seg[2]);
    if (seg[1] === 'YES') yes += gen; else if (seg[1] === 'NO') no += gen;
    holders.push({ address: seg[0], side: seg[1], amount: gen });
  }

  const total = yes + no;
  return {
    id, question, status, outcome, pool, yes, no, holders,
    yesPrice: total > 0 ? yes / total : 0.5,
    noPrice: total > 0 ? no / total : 0.5,
  };
}

/** Parimutuel payout preview, computed client-side from on-chain pools.
 *
 * Note on one-sided markets: if nobody has staked the opposing side, the
 * winning pool equals the whole pool, so payout == your stake and ROI is 0%.
 * That is mathematically correct, not a bug — you can only win other people's
 * money. Callers should surface that explicitly instead of showing "0%".
 */
export function previewPayout(market, side, stakeGen) {
  const amt = parseFloat(stakeGen) || 0;
  if (amt <= 0) return { payout: 0, profit: 0, roi: 0, opposing: 0, oneSided: false };

  const sidePool = side === 'YES' ? market.yes : market.no;
  const opposing = side === 'YES' ? market.no : market.yes;

  const winningPool = sidePool + amt;      // your stake joins the winning side
  const totalPool = market.pool + amt;     // and the total pot

  let payout = winningPool > 0 ? (amt * totalPool) / winningPool : amt;

  // Guard against float dust producing -0.00 / -0%.
  if (!isFinite(payout) || payout < 0) payout = 0;
  const profit = Math.abs(payout - amt) < 1e-12 ? 0 : payout - amt;
  const roi = amt > 0 ? (profit / amt) * 100 : 0;

  return {
    payout,
    profit,
    roi: Object.is(roi, -0) ? 0 : roi,
    opposing,
    oneSided: opposing <= 0,
  };
}

/** Payout multiplier for a side, independent of stake size.
 *
 * This is what a market's odds actually mean: stake 1 GEN on `side` and you'd
 * get back roughly `multiplier` GEN if it wins. Unlike previewPayout it does
 * NOT need an amount, so the UI can show meaningful per-side numbers BEFORE
 * the user types anything — otherwise both YES and NO read "+0.00 GEN / 0%",
 * which looks identical and therefore broken.
 *
 * Uses a nominal 1-unit stake so the ratio reflects current pool balance.
 */
export function sideMultiplier(market, side) {
  const sidePool = side === 'YES' ? market.yes : market.no;
  const opposing = side === 'YES' ? market.no : market.yes;
  if (opposing <= 0) return { multiplier: 1, impliedPct: null, oneSided: true };

  // Limit case for a small stake: total / winning side.
  const multiplier = sidePool > 0 ? market.pool / sidePool : Infinity;
  return {
    multiplier,
    impliedPct: (multiplier - 1) * 100,
    oneSided: false,
  };
}

/** Settlement payouts for a resolved/settled market.
 *
 * Parimutuel: each winner receives their share of the WHOLE pool in proportion
 * to their stake on the winning side. Losers receive nothing. Unlike
 * previewPayout (which models adding new money), this settles existing stakes.
 *
 * Multiple stakes by the same wallet are AGGREGATED — the on-chain v15 claim
 * had a bug where it stopped at the first match, underpaying repeat stakers.
 */
export function settlementPayouts(market) {
  const outcome = market.outcome;
  if (!outcome || (market.status !== 'SETTLED' && market.status !== 'RESOLVED')) return [];

  // Aggregate per address per side.
  const byAddr = new Map();
  for (const h of market.holders) {
    const k = h.address.toLowerCase();
    const cur = byAddr.get(k) || { address: h.address, yes: 0, no: 0 };
    if (h.side === 'YES') cur.yes += h.amount; else if (h.side === 'NO') cur.no += h.amount;
    byAddr.set(k, cur);
  }

  const winningPool = outcome === 'YES' ? market.yes : market.no;

  const rows = [];
  for (const v of byAddr.values()) {
    const won = outcome === 'YES' ? v.yes : v.no;
    const lost = outcome === 'YES' ? v.no : v.yes;
    const staked = v.yes + v.no;
    const payout = winningPool > 0 && won > 0 ? (won * market.pool) / winningPool : 0;
    rows.push({
      address: v.address,
      staked,
      winningStake: won,
      losingStake: lost,
      payout,
      profit: payout - staked,
      share: winningPool > 0 ? won / winningPool : 0,
      isWinner: won > 0,
    });
  }
  rows.sort((a, b) => b.payout - a.payout);
  return rows;
}

/** Raw JSON-RPC helper (read-only, no wallet needed). */
async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

/** Live GEN balance of any address — proves stakes are really escrowed. */
export async function addressBalance(addr) {
  const hex = await rpc('eth_getBalance', [addr, 'latest']);
  return Number(BigInt(hex)) / 1e18;
}

/** Fetch a tx and extract any emitted value-transfer messages.
 *
 * A claim returns FINISHED_WITH_RETURN once the transfer is EMITTED. The
 * emitted message is the on-chain evidence of the payout instruction:
 *   { messageType: 1, recipient, value, onAcceptance }
 * On Bradbury these settle at finalization, which lags acceptance — so we
 * report the emission AND the live tx status honestly.
 *
 * NOTE: tx data is NOT available over a plain JSON-RPC method. genlayer-js
 * reads it from the ConsensusData contract (getTransactionData /
 * getTransactionAllData), so we must go through the client, not fetch().
 * `gen_getTransactionByHash` and `gen_getTransactionsForAddress` do not exist.
 */
export async function transferEvidence(hash) {
  // A read-only client works without a connected wallet.
  const c = client || createClient({ chain: testnetBradbury });
  const tx = await c.getTransaction({ hash });
  if (!tx) return null;
  const msgs = (tx.messages || [])
    .filter((m) => m.value && BigInt(m.value) > 0n)
    .map((m) => ({
      recipient: m.recipient,
      gen: Number(BigInt(m.value)) / 1e18,
      onAcceptance: !!m.onAcceptance,
    }));
  return {
    hash,
    status: tx.statusName || String(tx.status),
    exec: tx.txExecutionResultName,
    transfers: msgs,
  };
}

export async function loadMarkets() {
  const count = Number(await read('getConfig'));
  const out = [];
  for (let i = 1; i <= count; i++) {
    const id = `market-${i}`;
    try {
      const m = parseMarket(id, await read('getMarket', [id]));
      if (m) out.push(m);
    } catch (e) { /* skip unreadable entry */ }
  }
  return out;
}

// Contract method signatures as actually deployed (v15):
//   createMarket(question)            -> marketId      (value 0)
//   stake(marketId, option)  payable  -> None          (value = GEN staked)
//   resolve(marketId)                 -> None          (creator only, value 0)
//                                        NOTE: v15 hardcodes the outcome to YES.
//   settle(marketId)                  -> None          (creator only, value 0)
//   claim(marketId)                   -> payout wei    (value 0)
//   getMarket(marketId) / getConfig() -> view
export const createMarket = (q) => write('createMarket', [q], '0');
export const stake = (id, side, gen) => write('stake', [id, side], gen);
export const resolve = (id) => write('resolve', [id], '0');
export const settle = (id) => write('settle', [id], '0');
export const claim = (id) => write('claim', [id], '0');
