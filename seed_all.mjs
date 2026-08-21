import { createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'fs'
import { Wallet } from 'ethers'

const RPC_URL = 'https://studio.genlayer.com/api'

const keystorePath = '/home/administrator/.genlayer/keystores/testwallet.json'
const keystore = readFileSync(keystorePath, 'utf8')
const wallet = Wallet.fromEncryptedJsonSync(keystore, 'genlayer2026')

const genlayerBradbury = defineChain({
  id: 698,
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

const FACTORY = '0xDD457e0F2FfE7B843f8C90f7997DB06714666CC9'

const markets = [
  {
    question: 'Will Ethereum exceed $5,000 by end of 2026?',
    rules: 'Outcome is YES if ETH/USD price on CoinGecko is above $5,000 at any point before Jan 1 2027.',
    source: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
  },
  {
    question: 'Will Manchester City win the 2026 Premier League?',
    rules: 'Outcome is YES if Manchester City wins the 2025-2026 Premier League title.',
    source: 'https://www.premierleague.com/tables',
  },
  {
    question: 'Will the US Federal Reserve cut interest rates in Q1 2026?',
    rules: 'Outcome is YES if the Federal Reserve lowers the federal funds rate between Jan 1 and Mar 31 2026.',
    source: 'https://www.federalreserve.gov/monetarypolicy.htm',
  },
  {
    question: 'Will Apple release a foldable iPhone by end of 2026?',
    rules: 'Outcome is YES if Apple officially announces a foldable iPhone before Jan 1 2027.',
    source: 'https://www.apple.com/iphone/',
  },
  {
    question: 'Will SpaceX land Starship on Mars by end of 2026?',
    rules: 'Outcome is YES if SpaceX successfully lands Starship on Mars surface before Jan 1 2027.',
    source: 'https://www.spacex.com/vehicles/starship/',
  },
]

async function main() {
  console.log('Address:', wallet.address)
  
  for (const m of markets) {
    console.log(`\nCreating: ${m.question}`)
    
    const data = encodeFunctionData({
      abi: parseAbi(['function createMarket(string question, string rules, string marketType, string[] options, string source1, string source2, string source3) returns (string)']),
      functionName: 'createMarket',
      args: [m.question, m.rules, 'BINARY', ['YES', 'NO'], m.source, '', ''],
    })

    const nonce = await publicClient.getTransactionCount({ address: account.address })
    const gasPrice = await publicClient.getGasPrice()

    const hash = await walletClient.sendTransaction({
      account,
      to: FACTORY,
      data,
      value: 0n,
      nonce,
      gasPrice,
      gas: 500000n,
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log(`  Status: ${receipt.status} | Tx: ${hash}`)
  }

  // Final count
  const count = await publicClient.readContract({
    address: FACTORY,
    abi: parseAbi(['function getConfig() view returns (uint256 marketCount)']),
    functionName: 'getConfig',
  })
  console.log(`\n=== TOTAL MARKETS: ${count.toString()} ===`)
}

main().catch(e => { console.error('Error:', e.message || e); process.exit(1) })
