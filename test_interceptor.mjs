// Test if fetch interceptor works with esm.sh modules
const _origFetch = window.fetch;
window.fetch = async (input, init) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      if (body.jsonrpc === '2.0' && typeof body.id === 'string') {
        console.log('INTERCEPTED: string id -> integer');
        body.id = parseInt(body.id, 10) || 1;
        init = { ...init, body: JSON.stringify(body) };
      }
    } catch {}
  }
  return _origFetch(input, init);
};

// Now import genlayer-js
const { createClient, createAccount } = await import('https://esm.sh/genlayer-js@1.1.8');
console.log('genlayer-js loaded');

// Try a read
const { testnetBradbury } = await import('https://esm.sh/genlayer-js@1.1.8/chains');
const client = createClient({ chain: testnetBradbury });
try {
  const result = await client.readContract({ address: '0x1168b74Cf4C9C42c7c1D7A16ed927774d8974275', functionName: 'getConfig', args: [] });
  console.log('Result:', result);
} catch (e) {
  console.log('Error:', e.message?.slice(0, 200));
}
