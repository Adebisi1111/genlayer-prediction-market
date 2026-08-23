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
  'function getConfig() view returns (uint256 marketCount)',
  'function getMarket(string marketId)',
  'function stake(string marketId, string option) payable',
])

async function main() {
  // Check current count
  const count = await publicClient.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: 'getConfig',
  })
  console.log('Current market count:', count.toString())
  
  // Create a test market
  console.log('\nCreating market...')
  const data = encodeFunctionData({
    abi: factoryAbi,
    functionName: 'createMarket',
    args: [
      'Will Bitcoin exceed $100,000 by end of 2026?',
      'Outcome is YES if BTC price is above $100,000.',
      'BINARY',
      ['YES', 'NO'],
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      '',
      '',
    ],
  })

  const hash = await walletClient.sendTransaction({
    account,
    to: FACTORY,
    data,
    value: 0n,
  })

  console.log('Tx hash:', hash)
  
  // Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log('Status:', receipt.status)
  console.log('Block:', receipt.blockNumber)
  console.log('Gas used:', receipt.gasUsed)
  
  // Check count again
  const newCount = await publicClient.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: 'getConfig',
  })
  console.log('New market count:', newCount.toString())
  
  // Check market-1
  const market = await publicClient.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: 'getMarket',
    args: ['market-1'],
  })
  console.log('Market-1:', market)
  
  // Try to stake
  console.log('\nStaking 1 GEN on YES...')
  const stakeData = encodeFunctionData({
    abi: factoryAbi,
    functionName: 'stake',
    args: ['market-1', 'YES'],
  })
  
  const stakeHash = await walletClient.sendTransaction({
    account,
    to: FACTORY,
    data: stakeData,
    value: 1000000000000000000n, // 1 GEN
  })
  
  console.log('Stake tx:', stakeHash)
  const stakeReceipt = await publicClient.waitForTransactionReceipt({ hash: stakeHash })
  console.log('Stake status:', stakeReceipt.status)
}

main().catch(e => { console.error('Error:', e.message || e); process.exit(1) })
