export function currentUserFromToken() {
  const t = localStorage.getItem('google_credential');
  if (!t) return null;
  try {
    const p = JSON.parse(atob(t.split('.')[1] || ''));
    const envAdmins = (process.env.REACT_APP_ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
    const envSups = (process.env.REACT_APP_SUPERVISOR_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
    let lsAdmins = [];
    let lsSups = [];
    try { lsAdmins = (localStorage.getItem('admin_emails') || '').split(',').map(s => s.trim()).filter(Boolean); } catch (e) { void e; }
    try { lsSups = (localStorage.getItem('supervisor_emails') || '').split(',').map(s => s.trim()).filter(Boolean); } catch (e) { void e; }
    const admins = Array.from(new Set([...envAdmins, ...lsAdmins]));
    const sups = Array.from(new Set([...envSups, ...lsSups]));
    // Prefer roles in token payload if present (e.g., demo or pre-signed JWTs)
    const roles = Array.isArray(p.roles) ? p.roles.map(String) : [];
    let role = 'user';
    if (roles.includes('admin')) role = 'admin';
    else if (roles.includes('supervisor')) role = 'supervisor';
    else if (p.email && admins.includes(p.email)) role = 'admin';
    else if (p.email && sups.includes(p.email)) role = 'supervisor';
    return { sub: p.sub, email: p.email, name: p.name, picture: p.picture, role };
  } catch (_) {
    return null;
  }
}
