import { createClient, createAccount } from 'https://esm.sh/genlayer-js@1.1.8';
import { testnetBradbury } from 'https://esm.sh/genlayer-js@1.1.8/chains';

// Global fetch interceptor to fix JSON-RPC id field.
// GenLayer's Go RPC server requires `id` to be an integer, but viem sends a string.
const _origFetch = window.fetch;
window.fetch = async (input, init) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      if (body.jsonrpc === '2.0' && typeof body.id === 'string') {
        body.id = parseInt(body.id, 10) || 1;
        init = { ...init, body: JSON.stringify(body) };
      }
    } catch {}
  }
  return _origFetch(input, init);
};

const FACTORY = '0x1168b74Cf4C9C42c7c1D7A16ed927774d8974275';
const EXPLORER_TX = 'https://explorer-bradbury.genlayer.com/tx/';
const EXPLORER_ADDR = 'https://explorer-bradbury.genlayer.com/address/';
const CHAIN_ID_HEX = '0x107d';

let client = null;
let address = null;

export const getAddress = () => address;
export const isConnected = () => !!client && !!address;
export const EXPLORER = EXPLORER_TX;

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
  if (!window.ethereum) throw new Error('No wallet detected. Open in MetaMask or Rabby.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts || !accounts.length) throw new Error('No account authorised.');
  await ensureChain();
  address = accounts[0];
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
  if (!raw || raw === 'NOT_FOUND') return null;
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
  return { id, question, status, outcome, pool, yes, no, holders,
           yesPrice: total > 0 ? yes / total : 0.5, noPrice: total > 0 ? no / total : 0.5 };
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

export async function getMarket(id) {
  const raw = await read('getMarket', [id]);
  return parseRaw(id, raw);
}

export async function stake(marketId, side, genAmount) { return write('stake', [marketId, side], genAmount); }
export async function createMarket(question) { return write('createMarket', [question], '0'); }
export async function resolve(marketId) { return write('resolve', [marketId], '0'); }
export async function settle(marketId) { return write('settle', [marketId], '0'); }
export async function claim(marketId) { return write('claim', [marketId], '0'); }

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
  if (sidePool <= 0) return opposing > 0 ? Infinity : 1;
  return (opposing + sidePool) / sidePool;
}

export function weiToGen(w) { return Number(BigInt(w || '0')) / 1e18; }
