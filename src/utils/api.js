export function getToken() {
  return localStorage.getItem('google_credential') || localStorage.getItem('token') || '';
}

const API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || process.env.REACT_APP_API_BASE || '/api';

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
    } catch (_) {}
    window.location.hash = '#/';
    throw new Error('Unauthorized');
  }
  return res;
}
