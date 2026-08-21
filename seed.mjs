// Polyfill window for Node.js
global.window = {
  ethereum: {
    request: async ({ method, params }) => {
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
        throw new Error('No MetaMask in Node.js');
      }
      if (method === 'eth_getBalance') {
        return '0x0';
      }
      return null;
    },
    on: () => {},
    removeListener: () => {},
  },
};

const { createClient } = await import('genlayer-js');
const { testnetBradbury } = await import('genlayer-js/chains');

const FACTORY = '0x6c2321c516f1793b5365Eb69d8257D6FbC885a7f';

const markets = [
  ['Will Bitcoin exceed $100,000 by end of 2026?','Outcome is YES if BTC/USD price on CoinGecko is above $100,000.','https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'],
  ['Will Ethereum exceed $5,000 by end of 2026?','Outcome is YES if ETH/USD price on CoinGecko is above $5,000.','https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'],
  ['Will Manchester City win the 2026 Premier League?','Outcome is YES if Manchester City wins the 2025-2026 Premier League.','https://www.premierleague.com/tables'],
];

async function main(){
  const client = createClient({ chain: testnetBradbury });
  await client.connect('testnetBradbury');
  for (const [q,r,s1] of markets){
    try {
      const tx = await client.writeContract({
        address: FACTORY,
        functionName: 'createMarket',
        args: [q, r, 'BINARY', ['YES','NO'], s1, '', ''],
        value: 1000000000000000000n,
      });
      console.log(`Created: ${q} -> ${tx}`);
    } catch(e) { console.error(`Failed: ${e.message}`); }
  }
}

main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
