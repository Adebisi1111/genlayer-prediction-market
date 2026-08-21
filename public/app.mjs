import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const FACTORY = "0x6c2321c516f1793b5365Eb69d8257D6FbC885a7f";
let client = null;
let account = null;
let isConnected = false;

async function connect(){
  const b = document.getElementById('addr'), btn = document.getElementById('connectBtn');
  if (isConnected) { disconnect(); return; }
  try {
    btn.textContent = "Connecting...";
    if (!window.ethereum) { alert("Open in MetaMask browser"); btn.textContent = "Connect Wallet"; return; }
    client = createClient({ chain: testnetBradbury });
    await client.connect('testnetBradbury');
    if (!client.account) {
      const [a] = await window.ethereum.request({ method: "eth_requestAccounts" });
      client.account = { address: a };
    }
    account = client.account;
    b.textContent = "Connected: " + account.address;
    btn.textContent = "Connected (tap to disconnect)";
    isConnected = true;
  } catch(e) { b.textContent = "Failed: " + e.message; btn.textContent = "Connect Wallet"; }
}

function disconnect(){
  client = null; account = null; isConnected = false;
  document.getElementById('addr').textContent = "Not connected";
  document.getElementById('connectBtn').textContent = "Connect Wallet";
}

async function createMarket(){
  if (!account) return alert("Connect wallet first");
  const q = prompt("Question:");
  if (!q) return;
  const r = prompt("Resolution rules:");
  if (!r) return;
  const s1 = prompt("Source URL 1:");
  if (!s1) return;
  const s2 = prompt("Source URL 2 (optional):") || "";
  const s3 = prompt("Source URL 3 (optional):") || "";
  try {
    const tx = await client.writeContract({
      address: FACTORY, functionName: "createMarket",
      args: [q, r, "BINARY", ["YES","NO"], s1, s2, s3],
      value: 1000000000000000000n,
    });
    alert("Market created! Tx: " + tx);
  } catch(e) { alert("Error: " + e.message); }
}

async function viewMarkets(){
  try {
    const r = await client.readContract({ address: FACTORY, functionName: "getMarketsPage", args: [1, 10] });
    const data = typeof r === 'string' ? JSON.parse(r) : r;
    const el = document.getElementById('marketsList');
    if (!data.markets || data.markets.length === 0) {
      el.innerHTML = '<div class="empty">No markets yet</div>';
    } else {
      el.innerHTML = data.markets.map(m => `
        <div class="market-card">
          <div class="market-q">${m.question}</div>
          <div class="market-meta">
            <span class="badge ${m.status}">${m.status}</span>
            <span>Pool: ${(m.total_pool/1e18).toFixed(2)} GEN</span>
            <span>${m.outcome ? '→ '+m.outcome : ''}</span>
          </div>
          <button onclick="stake('${m.market_id}')">Stake</button>
        </div>
      `).join('');
    }
  } catch(e) { alert("Error: " + e.message); }
}

async function stake(marketId){
  if (!account) return alert("Connect wallet first");
  const side = prompt("Side (YES/NO):");
  if (!side) return;
  const amt = prompt("Amount (GEN):");
  if (!amt) return;
  try {
    const tx = await client.writeContract({
      address: FACTORY, functionName: "stake",
      args: [marketId, side.toUpperCase()],
      value: BigInt(Math.floor(parseFloat(amt) * 1e18)),
    });
    alert("Staked! Tx: " + tx);
  } catch(e) { alert("Error: " + e.message); }
}

window.connect = connect;
window.createMarket = createMarket;
window.viewMarkets = viewMarkets;
window.stake = stake;
