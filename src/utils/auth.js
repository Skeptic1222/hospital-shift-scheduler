export function currentUserFromToken() {
  const t = localStorage.getItem('google_credential');
  if (!t) return null;
  try {
    const p = JSON.parse(atob(t.split('.')[1] || ''));
    const admins = (process.env.REACT_APP_ADMIN_EMAILS || 'sop1973@gmail.com').split(',').map(s => s.trim()).filter(Boolean);
    const sups = (process.env.REACT_APP_SUPERVISOR_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
    let role = 'user';
    if (p.email && admins.includes(p.email)) role = 'admin';
    else if (p.email && sups.includes(p.email)) role = 'supervisor';
    return { sub: p.sub, email: p.email, name: p.name, picture: p.picture, role };
  } catch (_) {
    return null;
  }
}
