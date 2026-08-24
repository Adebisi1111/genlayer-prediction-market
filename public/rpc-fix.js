// Patch fetch BEFORE genlayer-js loads
// Use Object.defineProperty so modules can't get the original
(function() {
  const _fetch = window.fetch;
  let requestId = 0;
  
  const patchedFetch = function(input, init) {
    if (init && init.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        if (body.jsonrpc === '2.0') {
          if (typeof body.id === 'string') {
            body.id = parseInt(body.id, 10) || 1;
          } else if (typeof body.id !== 'number') {
            body.id = ++requestId;
          }
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch(e) {}
    }
    return _fetch.call(window, input, init);
  };
  
  // Make it non-configurable and non-writable so modules can't override
  Object.defineProperty(window, 'fetch', {
    value: patchedFetch,
    configurable: false,
    writable: false,
  });
})();
