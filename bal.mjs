const RPC = 'https://rpc-bradbury.genlayer.com';
async function bal(addr) {
  const res = await fetch(RPC, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [addr, 'latest'] }),
  });
  const j = await res.json();
  return j.result ? Number(BigInt(j.result)) / 1e18 : null;
}
for (const a of process.argv.slice(2)) {
  console.log(`${a}  ${await bal(a)} GEN`);
}
