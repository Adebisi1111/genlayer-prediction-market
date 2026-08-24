import { createClient, createAccount } from 'https://esm.sh/genlayer-js@1.1.8';
import { testnetBradbury } from 'https://esm.sh/genlayer-js@1.1.8/chains';

const FACTORY = '0x0c100c4dC2f36e39F75C92f62De86d279eC7fB82';
const RPC_URL = 'https://rpc-bradbury.genlayer.com';
const EXPLORER_TX = 'https://explorer-bradbury.genlayer.com/tx/';
const EXPLORER_ADDR = 'https://explorer-bradbury.genlayer.com/address/';
const CHAIN_ID_HEX = '0x107d';

let client = null;
let address = null;
let requestId = 0;

// Custom fetch that fixes JSON-RPC id
const customFetch = async (url, init) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      if (body.jsonrpc === '2.0') {
        if (typeof body.id === 'string') {
          body.id = parseInt(body.id, 10) || 1;
        } else if (typeof body.id !== 'number') {
          body.id = ++requestId;
        }
        init = { ...init, body: JSON.stringify(body) };
      }
    } catch {}
  }
  return fetch(url, init);
};

export const getAddress = () => address;
export const isConnected = () => !!client && !!address;
export const EXPLORER = EXPLORER_TX;

function publicClient() {
  return createClient({ chain: testnetBradbury, fetch: customFetch });
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
          rpcUrls: [RPC_URL],
          blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
        }],
      });
    } else {
      throw err;
    }
  }
}

export async function connect() {
  if (!window.ethereum) throw new Error('No wallet detected. Open in MetaMask or Rabby.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts || !accounts.length) throw new Error('No account authorised.');
  await ensureChain();
  address = accounts[0];
  client = createClient({
    chain: testnetBradbury,
    account: address,
    provider: window.ethereum,
    fetch: customFetch,
  });
  return address;
}

export function disconnect() { client = null; address = null; }

export async function read(functionName, args = []) {
  const c = client ?? publicClient();
  return c.readContract({ address: FACTORY, functionName, args });
}

export async function write(functionName, args = [], genAmount = '0') {
  if (!client) throw new Error('Connect your wallet first.');
  const value = BigInt(Math.round(parseFloat(genAmount || '0') * 1e18));
  const hash = await client.writeContract({ address: FACTORY, functionName, args, value });
  const receipt = await client.waitForTransactionReceipt({ hash, retries: 100, interval: 5000 });
  let lr = receipt?.consensus_data?.leader_receipt;
  if (Array.isArray(lr)) lr = lr[0];
  const exec = receipt?.txExecutionResultName ?? lr?.execution_result;
  if (exec !== 'FINISHED_WITH_RETURN') {
    throw new Error(`Transaction did not finish cleanly (${exec ?? 'unknown'}).`);
  }
  return { hash, exec };
}

export async function getBalance() {
  if (!address) return 0;
  const wei = await window.ethereum.request({ method: 'eth_getBalance', params: [address, 'latest'] });
  return Number(BigInt(wei)) / 1e18;
}

function parseRaw(id, raw) {
  if (!raw || typeof raw !== 'string' || raw === 'NOT_FOUND') return null;
  const parts = String(raw).split('|');
  const question = parts[0] ?? '';
  const status = parts[1] ?? '';
  const outcome = parts[2] ?? '';
  const pool = Number(BigInt(parts[3] || '0')) / 1e18;
  const positions = parts[4] ?? '';
  let yes = 0, no = 0;
  const holders = [];
  for (const p of positions.split('|')) {
    if (!p) continue;
    const seg = p.split(':');
    if (seg.length < 3) continue;
    const gen = Number(BigInt(seg[2])) / 1e18;
    if (seg[1] === 'YES') yes += gen; else if (seg[1] === 'NO') no += gen;
    holders.push({ address: seg[0], side: seg[1], amount: gen });
  }
  const total = yes + no;
  return {
    id, question, status, outcome, pool: pool || 0, yes: yes || 0, no: no || 0, holders,
    yesPrice: total > 0 ? yes / total : 0.5,
    noPrice: total > 0 ? no / total : 0.5,
    empty: total <= 0,
    oneSided: yes <= 0 || no <= 0,
    multiplier: total > 0 ? (yes + no) / Math.max(yes, no) : 1,
    impliedPct: total > 0 ? ((yes + no) / Math.max(yes, no) - 1) * 100 : 0,
    opposing: 0,
  };
}

export function parseMarket(id, raw) { return parseRaw(id, raw); }

export async function loadMarkets() {
  const count = parseInt(await read('getConfig', []));
  const markets = [];
  for (let i = 1; i <= count; i++) {
    const raw = await read('getMarket', [`market-${i}`]);
    const m = parseRaw(`market-${i}`, raw);
    if (m) markets.push(m);
  }
  return markets;
}

export async function getPayout(user) { return read('getPayout', [user]); }
export async function getMarket(id) {
  const raw = await read('getMarket', [id]);
  return parseRaw(id, raw);
}

export async function stake(marketId, side, genAmount) { return write('stake', [marketId, side], genAmount); }
export async function createMarket(question) { return write('createMarket', [question], '0'); }
export async function resolve(marketId) { return write('resolve', [marketId], '0'); }
export async function settle(marketId) { return write('settle', [marketId], '0'); }
export async function claim(marketId) { return write('claim', [marketId], '0'); }
export async function withdraw() { return write('withdraw', [], '0'); }

export function previewPayout(market, side, stakeGen) {
  const amt = parseFloat(stakeGen) || 0;
  if (amt <= 0) return { payout: 0, profit: 0, roi: 0, opposing: 0, oneSided: false };
  const sidePool = side === 'YES' ? market.yes : market.no;
  const opposing = side === 'YES' ? market.no : market.yes;
  const winningPool = sidePool + amt;
  const totalPool = market.pool + amt;
  let payout = winningPool > 0 ? (amt * totalPool) / winningPool : amt;
  if (!isFinite(payout) || payout < 0) payout = 0;
  const profit = Math.abs(payout - amt) < 1e-12 ? 0 : payout - amt;
  const roi = amt > 0 ? (profit / amt) * 100 : 0;
  return { payout, profit, roi: Object.is(roi, -0) ? 0 : roi, opposing, oneSided: opposing <= 0 };
}

export function sideMultiplier(market, side) {
  const sidePool = side === 'YES' ? market.yes : market.no;
  const opposing = side === 'YES' ? market.no : market.yes;
  const total = market.yes + market.no;
  if (total <= 0) return { empty: true, oneSided: true, multiplier: 1, impliedPct: 0, opposing: 0 };
  if (sidePool <= 0) return { empty: false, oneSided: true, multiplier: Infinity, impliedPct: Infinity, opposing };
  const multiplier = (sidePool + opposing) / sidePool;
  return { empty: false, oneSided: opposing <= 0, multiplier, impliedPct: (multiplier - 1) * 100, opposing };
}

export function weiToGen(w) { return Number(BigInt(w || '0')) / 1e18; }
