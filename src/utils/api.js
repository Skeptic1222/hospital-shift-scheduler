export function getToken() {
  return localStorage.getItem('google_credential') || localStorage.getItem('token') || '';
}

// Simple API utility that uses relative URLs only
// IIS web.config handles proxying /api/* and /socket.io/* to Node.js backend
// No hardcoded ports, hostnames, or complex detection logic needed
export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  
  // Use relative URLs - let IIS handle routing via web.config
  const url = path.startsWith('/') ? path : `/${path}`;
  
  try {
    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401) {
      try {
        localStorage.removeItem('google_credential');
        localStorage.setItem('google_logged_out', '1');
      } catch (_) {
        // Silently handle localStorage errors
      }
      window.location.hash = '#/';
      throw new Error('Unauthorized');
    }
    
    return res;
  } catch (err) {
    // Network-level failure (proxy down, 502, DNS, etc.)
    const e = new Error('Network error: API unavailable');
    e.cause = err;
    throw e;
  }
}
