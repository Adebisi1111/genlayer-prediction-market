import { createPublicClient, http, defineChain } from 'viem'

const RPC_URL = 'https://studio.genlayer.com/api'

const genlayerBradbury = defineChain({
  id: 698,
  name: 'GenLayer Bradbury Testnet',
  rpcUrls: { default: { http: [RPC_URL] } },
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
})

const client = createPublicClient({
  chain: genlayerBradbury,
  transport: http(RPC_URL),
})

async function main() {
  const txHash = '0xc5f1feeeef476e36f420f5a0d351a7fc984b10dc43958bb326551e3e86cda099'
  const receipt = await client.getTransactionReceipt({ hash: txHash })
  console.log('Status:', receipt.status)
  console.log('Block:', receipt.blockNumber)
  console.log('Gas used:', receipt.gasUsed)
  console.log('Logs:', receipt.logs?.length || 0)
}

main().catch(e => { console.error('Error:', e.message || e); process.exit(1) })
