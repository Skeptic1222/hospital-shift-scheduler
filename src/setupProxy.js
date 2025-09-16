const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');

// ⚠️⚠️⚠️ CRITICAL: ABSOLUTE NO-PORT RULE ⚠️⚠️⚠️
// THIS FILE IS ONLY FOR INTERNAL DEVELOPMENT PROXY
// NEVER expose ports to users or in production URLs
// See NO-PORT-ABSOLUTE-RULE.md for details
// 
// VIOLATIONS OF THIS RULE ARE CRITICAL ERRORS:
// ❌ NEVER: http://localhost:3001 in user-facing code
// ❌ NEVER: Any URL with :port in production
// ✅ ONLY: Internal proxy targets (hidden from users)
//
// THIS FILE IS ONLY FOR DEVELOPMENT WITH CREATE REACT APP
// In production, IIS handles all proxying - NO PORTS ALLOWED
// Development proxy configuration
// In dev mode, Create React App needs to proxy /api and /socket.io requests
// to the backend Node.js server (internal port 3001 - NEVER exposed to users)
function getBackendTarget() {
  // Allow override via environment variable
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // Try to detect Windows host for WSL2 development
  if (process.env.WIN_HOST) {
    return `http://${process.env.WIN_HOST}:3001`;
  }
  
  try {
    // In WSL2, the default gateway/nameserver points to Windows host
    const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const m = resolv.match(/nameserver\s+([0-9.]+)/);
    if (m && m[1]) {
      return `http://${m[1]}:3001`;
    }
  } catch (_) {}
  
  // Default fallback for local development
  return 'http://localhost:3001';
}

const backendTarget = getBackendTarget();

module.exports = function(app) {
  // Proxy API requests to Node.js backend
  app.use('/api', createProxyMiddleware({ 
    target: backendTarget, 
    changeOrigin: true 
  }));
  
  // Proxy Socket.IO requests to Node.js backend
  app.use('/socket.io', createProxyMiddleware({ 
    target: backendTarget, 
    changeOrigin: true, 
    ws: true 
  }));
};
