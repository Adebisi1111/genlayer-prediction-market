import { createClient, decodeInputData } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const client = createClient({ chain: testnetBradbury });
const tx = await client.getTransaction({ hash: process.argv[2] });

console.log('=== txData keys ===', Object.keys(tx.txData || {}));
console.log('value    :', tx.txData?.value);

const cd = tx.txData?.calldata ?? tx.txCalldata;
console.log('calldata :', String(cd).slice(0, 200));

try {
  console.log('decoded  :', JSON.stringify(decodeInputData(cd)).slice(0, 400));
} catch (e) {
  console.log('decode err:', e.message.slice(0, 140));
}
