import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const client = createClient({ chain: testnetBradbury });

const window = global.window;
global.window = undefined;

await client.connect('testnetBradbury');
global.window = window;

const FACTORY = '0x29d0E94d4A6110bC426cBBb29e6aD30653C513c5';

const markets = [
  ['Will Bitcoin exceed $100,000 by end of 2026?','Outcome is YES if BTC/USD price on CoinGecko is above $100,000.','https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'],
  ['Will Ethereum exceed $5,000 by end of 2026?','Outcome is YES if ETH/USD price on CoinGecko is above $5,000.','https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'],
  ['Will Manchester City win the 2026 Premier League?','Outcome is YES if Manchester City wins the 2025-2026 Premier League.','https://www.premierleague.com/tables'],
  ['Will the US Federal Reserve cut rates in Q1 2026?','Outcome is YES if the Fed lowers rates between Jan 1 and Mar 31 2026.','https://www.federalreserve.gov/monetarypolicy.htm'],
  ['Will Apple release a foldable iPhone by end of 2026?','Outcome is YES if Apple announces a foldable iPhone before Jan 1 2027.','https://www.apple.com/iphone/'],
];

for (const [q,r,s1] of markets){
  try {
    const tx = await client.writeContract({
      address: FACTORY,
      functionName: 'createMarket',
      args: [q, r, 'BINARY', ['YES','NO'], s1, '', ''],
    });
    console.log(`Created: ${q} -> ${tx}`);
  } catch(e) { console.error(`Failed: ${e.message}`); }
}
