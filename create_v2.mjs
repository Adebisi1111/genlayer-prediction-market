import { createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'fs'
import { Wallet } from 'ethers'

const RPC_URL = 'https://studio.genlayer.com/api'

const keystorePath = '/home/administrator/.genlayer/keystores/testwallet.json'
const keystore = readFileSync(keystorePath, 'utf8')
const wallet = Wallet.fromEncryptedJsonSync(keystore, 'genlayer2026')
console.log('Address:', wallet.address)

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

async function main() {
  console.log('=== Creating market... ===')
  
  const data = encodeFunctionData({
    abi: parseAbi(['function createMarket(string question, string rules, string marketType, string[] options, string source1, string source2, string source3) returns (string)']),
    functionName: 'createMarket',
    args: [
      'Will Bitcoin exceed $100,000 by end of 2026?',
      'Outcome is YES if BTC/USD price on CoinGecko is above $100,000 at any point before Jan 1 2027.',
      'BINARY',
      ['YES', 'NO'],
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      '',
      '',
    ],
  })

  // Get nonce
  const nonce = await publicClient.getTransactionCount({ address: account.address })
  console.log('Nonce:', nonce)

  // Get gas price
  const gasPrice = await publicClient.getGasPrice()
  console.log('Gas price:', gasPrice)

  // Send transaction with explicit nonce and gas
  const hash = await walletClient.sendTransaction({
    account,
    to: FACTORY,
    data,
    value: 0n,
    nonce,
    gasPrice,
    gas: 500000n,
  })

  console.log('Tx hash:', hash)
  
  // Wait for receipt
  console.log('Waiting for receipt...')
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log('Receipt status:', receipt.status)
  console.log('Block number:', receipt.blockNumber)
  console.log('Gas used:', receipt.gasUsed)
  
  if (receipt.status === 'success') {
    console.log('=== SUCCESS! ===')
    console.log('Verify: https://explorer-bradbury.genlayer.com/tx/' + hash)
    
    // Check market count
    const count = await publicClient.readContract({
      address: FACTORY,
      abi: parseAbi(['function getConfig() view returns (uint256 marketCount)']),
      functionName: 'getConfig',
    })
    console.log('Market count:', count.toString())
  } else {
    console.log('=== TRANSACTION FAILED ===')
    console.log('Check explorer for details')
  }
}

main().catch(e => { console.error('Error:', e.message || e); process.exit(1) })
