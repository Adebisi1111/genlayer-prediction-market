import { createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'fs'
import { Wallet } from 'ethers'

const RPC_URL = 'https://rpc-bradbury.genlayer.com'
const FACTORY = '0x55512C7a3C44017B1a2b39E23F87431d9569BE6b'

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
  'function createMarket(string question) returns (string)',
  'function stake(string marketId, string option) payable',
  'function resolve(string marketId)',
  'function settle(string marketId)',
  'function claim(string marketId) returns (uint256)',
  'function getMarket(string marketId)',
  'function getConfig() view returns (uint256 marketCount)',
])

const markets = [
  'Will Bitcoin exceed $100,000 by end of 2026?',
  'Will Ethereum exceed $5,000 by end of 2026?',
  'Will Manchester City win the 2026 Premier League?',
  'Will the US Federal Reserve cut rates in Q1 2026?',
  'Will Apple release a foldable iPhone by end of 2026?',
]

async function main() {
  console.log('Creating markets on-chain...\n')
  
  for (let i = 0; i < markets.length; i++) {
    const q = markets[i]
    console.log(`Market ${i+1}: ${q}`)
    
    try {
      const data = encodeFunctionData({
        abi: factoryAbi,
        functionName: 'createMarket',
        args: [q],
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
    
    // Wait between transactions to avoid rate limiting
    if (i < markets.length - 1) {
      await new Promise(r => setTimeout(r, 30000))
    }
  }
  
  console.log('\nDone!')
}

main().catch(e => { console.error('Error:', e.message || e); process.exit(1) })
