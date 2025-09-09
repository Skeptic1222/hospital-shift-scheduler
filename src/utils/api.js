export function getToken() {
  return localStorage.getItem('google_credential') || localStorage.getItem('token') || '';
}

// Absolute public base preferred. Example values:
// - In Windows:  REACT_APP_PUBLIC_BASE=http://localhost/scheduler
// - In WSL dev:  REACT_APP_PUBLIC_BASE=http://PUBLIC_IP/scheduler
let API_BASE = process.env.REACT_APP_PUBLIC_BASE || (typeof window !== 'undefined' && window.__PUBLIC_BASE__);
if (!API_BASE) {
  // Fallback to same-origin + /scheduler
  try {
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) || '';
    API_BASE = `${origin}/scheduler`;
  } catch (_) {
    API_BASE = '/scheduler';
  }
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
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
}
