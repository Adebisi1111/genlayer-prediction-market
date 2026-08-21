import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

// Disable window requirement
global.window = { 
  ethereum: { 
    request: async () => { throw new Error("no ethereum"); },
    on: () => {},
    removeListener: () => {}
  } 
};

const client = createClient({ chain: testnetBradbury });
await client.connect("testnetBradbury");
console.log("Connected, account:", client.account);

const FACTORY = "0xDD457e0F2FfE7B843f8C90f7997DB06714666CC9";

try {
  const result = await client.writeContract({
    address: FACTORY,
    functionName: "createMarket",
    args: ["Will Bitcoin exceed $100,000 by end of 2026?","Outcome is YES if BTC/USD price on CoinGecko is above $100,000.","BINARY",["YES","NO"],"https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd","",""],
  });
  console.log("Result:", result);
} catch(e) {
  console.error("Error:", e.message);
}
