import { createPublicClient, http, parseAbi, defineChain } from 'viem'

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

const FACTORY = '0xDD457e0F2FfE7B843f8C90f7997DB06714666CC9'

async function main() {
  // Try different ABI formats
  console.log('=== Test 1: getConfig ===')
  try {
    const count = await client.readContract({
      address: FACTORY,
      abi: parseAbi(['function getConfig() view returns (uint256 marketCount)']),
      functionName: 'getConfig',
    })
    console.log('Count:', count.toString())
  } catch(e) { console.log('Error:', e.message) }

  console.log('\n=== Test 2: market_count() ===')
  try {
    const count = await client.readContract({
      address: FACTORY,
      abi: parseAbi(['function market_count() view returns (uint256)']),
      functionName: 'market_count',
    })
    console.log('Count:', count.toString())
  } catch(e) { console.log('Error:', e.message) }

  console.log('\n=== Test 3: getMarketsPage(1,5) ===')
  try {
    const result = await client.readContract({
      address: FACTORY,
      abi: parseAbi(['function getMarketsPage(uint256 page, uint256 limit)']),
      functionName: 'getMarketsPage',
      args: [1n, 5n],
    })
    console.log('Result:', result)
  } catch(e) { console.log('Error:', e.message) }

  console.log('\n=== Test 4: getMarket(market-1) ===')
  try {
    const result = await client.readContract({
      address: FACTORY,
      abi: parseAbi(['function getMarket(string marketId) view returns (bool exists, string marketId, string creator, string question, string rules, string marketType, string[] options, string source1, string status, string outcome, uint256 totalPool)']),
      functionName: 'getMarket',
      args: ['market-1'],
    })
    console.log('Result:', result)
  } catch(e) { console.log('Error:', e.message) }
}

main().catch(e => { console.error('Error:', e.message || e); process.exit(1) })
