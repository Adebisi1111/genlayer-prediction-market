// Patch fetch BEFORE genlayer-js loads
(function() {
  const _fetch = window.fetch;
  window.fetch = function(input, init) {
    if (init && init.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        if (body.jsonrpc === '2.0' && typeof body.id === 'string') {
          body.id = parseInt(body.id, 10) || 1;
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch(e) {}
    }
    return _fetch.call(window, input, init);
  };
})();
