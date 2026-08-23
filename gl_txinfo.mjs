import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const client = createClient({ chain: testnetBradbury });
const tx = await client.getTransaction({ hash: process.argv[2] });

console.log('sender    :', tx.sender);
console.log('recipient :', tx.recipient);
console.log('value     :', tx.txData?.value ?? tx.value);
console.log('decoded   :', JSON.stringify(tx.txDataDecoded, null, 2)?.slice(0, 600));
console.log('exec      :', tx.txExecutionResultName);
