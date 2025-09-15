(function(){
  try {
    // Force absolute, portless base for all API/WS calls
    if (!window.__PUBLIC_BASE__) {
      window.__PUBLIC_BASE__ = location.origin.replace(/\/$/, '') + '/scheduler';
    }
    // Force polling transport for older cached bundles (avoid WS handshake issues)
    window.__FORCE_POLLING__ = true;
    try { if (window.__FORCE_POLLING__ && 'WebSocket' in window) { window.WebSocket = undefined; } } catch(_){}
    // Use BrowserRouter by default with IIS URL Rewrite
    window.__USE_HASH_ROUTER__ = false;
  } catch (e) {}
})();

