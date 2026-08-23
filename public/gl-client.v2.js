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
