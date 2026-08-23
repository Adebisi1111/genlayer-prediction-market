import { createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'fs'
import { Wallet } from 'ethers'

const RPC_URL = 'https://rpc-bradbury.genlayer.com'
const FACTORY = '0xDD457e0F2FfE7B843f8C90f7997DB06714666CC9'

const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8')
const wallet = Wallet.fromEncryptedJsonSync(keystore, 'genlayer2026')
console.log('Address:', wallet.address)

const genlayerBradbury = defineChain({
  id: 4221,
  name: 'GenLayer Bradbury Testnet',
  rpcUrls: { default: { http: [RPC_URL] } },
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
})

const account = privateKeyToAccount(wallet.privateKey)

const publicClient = createPublicClient({
  chain: genlayerBradbury,
  transport: http(RPC_URL),
})

const walletClient = createWalletClient({
  account,
  chain: genlayerBradbury,
  transport: http(RPC_URL),
})

const factoryAbi = parseAbi([
  'function createMarket(string question, string rules, string marketType, string[] options, string source1, string source2, string source3) returns (string)',
  'function stake(string marketId, string option) payable',
])

async function main() {
  console.log('Creating 5 markets on-chain...\n')
  
  const markets = [
    ['Will Bitcoin exceed $100,000 by end of 2026?', 'Outcome is YES if BTC price is above $100,000.', 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'],
    ['Will Ethereum exceed $5,000 by end of 2026?', 'Outcome is YES if ETH price is above $5,000.', 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'],
    ['Will Manchester City win the 2026 Premier League?', 'Outcome is YES if Man City wins.', 'https://www.premierleague.com/tables'],
    ['Will the US Federal Reserve cut rates in Q1 2026?', 'Outcome is YES if Fed cuts rates.', 'https://www.federalreserve.gov/monetarypolicy.htm'],
    ['Will Apple release a foldable iPhone by end of 2026?', 'Outcome is YES if Apple announces foldable.', 'https://www.apple.com/iphone/'],
  ]
  
  for (let i = 0; i < markets.length; i++) {
    const [q, r, s1] = markets[i]
    console.log(`Market ${i+1}: ${q}`)
    
    try {
      const data = encodeFunctionData({
        abi: factoryAbi,
        functionName: 'createMarket',
        args: [q, r, 'BINARY', ['YES', 'NO'], s1, '', ''],
      })

      const hash = await walletClient.sendTransaction({
        account,
        to: FACTORY,
        data,
        value: 0n,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      console.log(`  ✅ Created | Tx: ${hash.slice(0, 20)}... | Gas: ${receipt.gasUsed}`)
    } catch(e) {
      console.log(`  ❌ Failed: ${e.message?.slice(0, 80)}`)
    }
  }
  
  console.log('\nDone!')
}

main().catch(e => { console.error('Error:', e.message || e); process.exit(1) })
