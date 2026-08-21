import { createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'fs'
import { Wallet } from 'ethers'

// ============================================================
// CONFIGURATION - Replace these with your values
// ============================================================
const RPC_URL = 'https://studio.genlayer.com/api'
const KEYSTORE_PATH = '/home/administrator/.genlayer/keystores/testwallet.json'
const KEYSTORE_PASSWORD = 'genlayer2026'
const FACTORY = '0xDD457e0F2FfE7B843f8C90f7997DB06714666CC9'

// ============================================================
// DECRYPT PRIVATE KEY FROM KEYSTORE
// ============================================================
const keystore = readFileSync(KEYSTORE_PATH, 'utf8')
const wallet = Wallet.fromEncryptedJsonSync(keystore, KEYSTORE_PASSWORD)
console.log('Address:', wallet.address)

// ============================================================
// CHAIN CONFIG - GenLayer Bradbury Testnet
// ============================================================
const genlayerBradbury = defineChain({
  id: 698,
  name: 'GenLayer Bradbury Testnet',
  rpcUrls: { default: { http: [RPC_URL] } },
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
})

// ============================================================
// ACCOUNT & CLIENTS
// ============================================================
const account = privateKeyToAccount(wallet.privateKey)

export const publicClient = createPublicClient({
  chain: genlayerBradbury,
  transport: http(RPC_URL),
})

export const walletClient = createWalletClient({
  account,
  chain: genlayerBradbury,
  transport: http(RPC_URL),
})

// ============================================================
// CONTRACT ABI
// ============================================================
const factoryAbi = parseAbi([
  'function createMarket(string question, string rules, string marketType, string[] options, string source1, string source2, string source3) returns (string)',
  'function getConfig() view returns (uint256 marketCount)',
  'function stake(string marketId, string option) payable',
])

// ============================================================
// FUNCTIONS
// ============================================================

export async function createMarket({ question, rules, options, source }) {
  const data = encodeFunctionData({
    abi: factoryAbi,
    functionName: 'createMarket',
    args: [question, rules, 'BINARY', options, source, '', ''],
  })

  const hash = await walletClient.sendTransaction({
    account,
    to: FACTORY,
    data,
    value: 0n,
  })

  console.log('createMarket tx hash:', hash)
  return hash
}

export async function getMarketCount() {
  const result = await publicClient.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: 'getConfig',
  })
  return result
}

export async function stake(marketId, option, amountWei) {
  const data = encodeFunctionData({
    abi: factoryAbi,
    functionName: 'stake',
    args: [marketId, option],
  })

  const hash = await walletClient.sendTransaction({
    account,
    to: FACTORY,
    data,
    value: BigInt(amountWei),
  })

  console.log('stake tx hash:', hash)
  return hash
}

// ============================================================
// MAIN - Run this file directly to create a market
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Creating market... ===')
  
  const tx = await createMarket({
    question: 'Will Bitcoin exceed $100,000 by end of 2026?',
    rules: 'Outcome is YES if BTC/USD price on CoinGecko is above $100,000 at any point before Jan 1 2027.',
    options: ['YES', 'NO'],
    source: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
  })

  console.log('=== Success! ===')
  console.log('Transaction:', tx)
  console.log('Verify on explorer: https://explorer-bradbury.genlayer.com/tx/' + tx)
}
