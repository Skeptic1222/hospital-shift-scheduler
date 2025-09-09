const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');

function detectWindowsHost() {
  if (process.env.WIN_PUBLIC_URL) return process.env.WIN_PUBLIC_URL.replace(/\/$/, '');
  if (process.env.WIN_HOST) return `http://${process.env.WIN_HOST}`;
  try {
    // In WSL2, the default gateway/nameserver points to Windows host
    const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const m = resolv.match(/nameserver\s+([0-9.]+)/);
    if (m && m[1]) return `http://${m[1]}`;
  } catch (_) {}
  // Fallback to localhost:3001 if detection fails
  return 'http://localhost:3001';
}

const winBase = detectWindowsHost();
const schedulerBase = `${winBase}/scheduler`;

module.exports = function(app) {
  // Dev API proxy for both /api and /scheduler/api
  // Prefer proxying to Windows IIS public URL (no ports in browser). If detection fails, it will fall back to :3001
  // Route /api to the Windows /scheduler app so IIS handles proxying to Node
  app.use('/api', createProxyMiddleware({ target: schedulerBase, changeOrigin: true }));
  app.use('/scheduler/api', createProxyMiddleware({ target: schedulerBase, changeOrigin: true }));
  // Proxy Socket.IO for dev so the browser uses same-origin '/socket.io'
  app.use('/socket.io', createProxyMiddleware({ target: schedulerBase, changeOrigin: true, ws: true }));
  app.use('/scheduler/socket.io', createProxyMiddleware({ target: schedulerBase, changeOrigin: true, ws: true }));
};
