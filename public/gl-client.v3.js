import { ethers } from 'https://esm.sh/ethers@6.13.4';

const FACTORY = '0x1168b74Cf4C9C42c7c1D7A16ed927774d8974275';
const RPC_URL = 'https://rpc-bradbury.genlayer.com';
const EXPLORER_TX = 'https://explorer-bradbury.genlayer.com/tx/';
const EXPLORER_ADDR = 'https://explorer-bradbury.genlayer.com/address/';
const CHAIN_ID = 4221;

const ABI = [
  'function createMarket(string question) returns (string)',
  'function stake(string marketId, string option) payable',
  'function resolve(string marketId)',
  'function settle(string marketId)',
  'function claim(string marketId) returns (uint256)',
  'function getMarket(string marketId) returns (string)',
  'function getConfig() returns (string)',
];

let provider = null;
let signer = null;
let address = null;

export const getAddress = () => address;
export const isConnected = () => !!provider && !!address;
export const EXPLORER = EXPLORER_TX;

async function ensureChain() {
  const current = await window.ethereum.request({ method: 'eth_chainId' });
  if (current === '0x' + CHAIN_ID.toString(16)) return;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + CHAIN_ID.toString(16) }],
    });
  } catch (err) {
    if (err && (err.code === 4902 || err.code === -32603)) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x' + CHAIN_ID.toString(16),
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
  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  return address;
}

export function disconnect() { provider = null; signer = null; address = null; }

export async function read(functionName, args = []) {
  const p = provider || new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(FACTORY, ABI, p);
  return contract[functionName](...args);
}

export async function write(functionName, args = [], genAmount = '0') {
  if (!signer) throw new Error('Connect your wallet first.');
  const value = BigInt(Math.round(parseFloat(genAmount || '0') * 1e18));
  const contract = new ethers.Contract(FACTORY, ABI, signer);
  const tx = await contract[functionName](...args, { value });
  const receipt = await tx.wait();
  return { hash: tx.hash, exec: receipt?.status === 1 ? 'FINISHED_WITH_RETURN' : 'FINISHED_WITH_ERROR' };
}

export async function getBalance() {
  if (!address || !provider) return 0;
  return Number(await provider.getBalance(address)) / 1e18;
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

export async function getMarket(id) {
  return parseRaw(id, await read('getMarket', [id]));
}

export async function loadMarkets() {
  const count = parseInt(await read('getConfig', []));
  const markets = [];
  for (let i = 1; i <= count; i++) {
    const m = parseRaw(`market-${i}`, await read('getMarket', [`market-${i}`]));
    if (m) markets.push(m);
  }
  return markets;
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
