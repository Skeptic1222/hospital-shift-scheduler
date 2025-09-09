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
    const admins = Array.from(new Set([...envAdmins, ...lsAdmins, 'sop1973@gmail.com']));
    const sups = Array.from(new Set([...envSups, ...lsSups]));
    let role = 'user';
    if (p.email && admins.includes(p.email)) role = 'admin';
    else if (p.email && sups.includes(p.email)) role = 'supervisor';
    return { sub: p.sub, email: p.email, name: p.name, picture: p.picture, role };
  } catch (_) {
    return null;
  }
}
