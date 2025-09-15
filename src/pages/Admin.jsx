import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Grid,
  Alert
} from '@mui/material';
import StandardButton from '../components/common/StandardButton';
import { currentUserFromToken } from '../utils/auth';
import { ErrorMessage } from '../components/common/ErrorState';
import { useResponsive } from '../hooks/useResponsive';
import { useNotification } from '../contexts/NotificationContext';

const Admin = () => {
  const me = useMemo(() => currentUserFromToken(), []);
  const isAdmin = me?.role === 'admin';
  const { isMobile } = useResponsive();
  const [roles, setRoles] = useState([]);
  const [email, setEmail] = useState('');
  const [roleName, setRoleName] = useState('supervisor');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [seedBusy, setSeedBusy] = useState(false);
  const [messageType, setMessageType] = useState('info');
  const [allUsers, setAllUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [query, setQuery] = useState('');
  const [updatingUser, setUpdatingUser] = useState('');
  const [demoMode, setDemoMode] = useState(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const { add: addToast } = useNotification();

  useEffect(() => { if (isAdmin) loadRoles(); }, [isAdmin]);
  useEffect(() => { if (isAdmin) loadUsers(); }, [isAdmin]);
  useEffect(() => { if (isAdmin) loadDepartments(); }, [isAdmin]);
  useEffect(() => { if (isAdmin) loadSettings(); }, [isAdmin]);

  async function loadRoles() {
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/admin/roles');
      const data = await res.json();
      setRoles(data.roles || []);
    } catch (_) { setRoles([{ name: 'admin' }, { name: 'supervisor' }, { name: 'user' }]); }
  }

  async function seedRoles() {
    try {
      setBusy(true); setMessage(''); setMessageType('info');
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/admin/roles/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) { setMessage('Roles seeded successfully'); setMessageType('success'); loadRoles(); }
      else { setMessage('Failed to seed roles'); setMessageType('error'); }
    } catch (_) { setMessage('Failed to seed roles'); setMessageType('error'); }
    finally { setBusy(false); }
  }

  async function assignRole() {
    try {
      setBusy(true); setMessage(''); setMessageType('info');
      const { apiFetch } = await import('../utils/api');
      const payload = { email, roleName, first_name: firstName, last_name: lastName };
      if (department) {
        // if selection is a UUID-like id, pass department_id; otherwise department_code
        if (/^[0-9a-fA-F-]{32,}$/.test(department)) payload.department_id = department;
        else payload.department_code = department;
      }
      const res = await apiFetch('/api/admin/users/assign-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        setMessage('Role assigned successfully');
        setMessageType('success');
        setEmail(''); setFirstName(''); setLastName(''); setDepartment('');
        // Refresh list to ensure the new/updated user appears
        loadUsers();
      }
      else { setMessage('Failed to assign role'); setMessageType('error'); }
    } catch (_) { setMessage('Failed to assign role'); setMessageType('error'); }
    finally { setBusy(false); }
  }

  async function loadDepartments() {
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/departments');
      const data = await res.json();
      setDepartments(data.departments || []);
    } catch (_) { setDepartments([]); }
  }

  async function loadSettings() {
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/admin/settings');
      const data = await res.json();
      setDemoMode(!!data.demo_mode);
    } catch (_) { setDemoMode(null); }
  }

  async function toggleDemoMode() {
    try {
      setSettingsBusy(true);
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo_mode: !demoMode })
      });
      if (res.ok) {
        setDemoMode(!demoMode);
        setMessage(`Switched to ${!demoMode ? 'Demo' : 'Live'} mode`);
        setMessageType('success');
        // Refresh data to reflect mode change
        loadUsers();
        loadRoles();
      } else {
        const t = await res.json().catch(()=>({}));
        setMessage(`Failed to update mode: ${t?.error || ''}`);
        setMessageType('error');
      }
    } catch (_) {
      setMessage('Failed to update mode'); setMessageType('error');
    } finally { setSettingsBusy(false); }
  }

  async function loadUsers() {
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/staff');
      const data = await res.json();
      const users = (data.staff || []).map(u => ({
        id: u.id,
        email: u.email,
        name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        department: u.department_name || u.department_id || '',
        role: u.role || (u.title && u.title.toLowerCase().includes('supervisor') ? 'supervisor' : 'user'),
      }));
      setAllUsers(users);
      setFiltered(users);
    } catch (_) {
      // fallback demo
      setAllUsers([]);
      setFiltered([]);
    }
  }

  function filterUsers(q) {
    const qq = (q || '').toLowerCase();
    if (!qq) return setFiltered(allUsers);
    setFiltered(allUsers.filter(u => (
      (u.email || '').toLowerCase().includes(qq) ||
      (u.name || '').toLowerCase().includes(qq) ||
      (u.department || '').toLowerCase().includes(qq) ||
      (u.role || '').toLowerCase().includes(qq)
    )));
  }

  async function updateUserRole(emailToUpdate, newRole) {
    try {
      setUpdatingUser(emailToUpdate);
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/admin/users/assign-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUpdate, roleName: newRole })
      });
      if (res.ok) {
        setMessage(`Updated ${emailToUpdate} to ${newRole}`);
        setMessageType('success');
        addToast({ severity: 'success', message: `Updated ${emailToUpdate} to ${newRole}` });
        // reflect locally
        setAllUsers(prev => prev.map(u => u.email === emailToUpdate ? { ...u, role: newRole } : u));
        setFiltered(prev => prev.map(u => u.email === emailToUpdate ? { ...u, role: newRole } : u));
      } else {
        setMessage('Failed to update role');
        setMessageType('error');
        addToast({ severity: 'error', message: 'Failed to update role' });
      }
    } catch (_) {
      setMessage('Failed to update role');
      setMessageType('error');
      addToast({ severity: 'error', message: 'Failed to update role' });
    } finally {
      setUpdatingUser('');
    }
  }

  async function seedStaff() {
    try {
      setSeedBusy(true); setMessage(''); setMessageType('info');
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/seed/radtechs', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ count: 20 })
      });
      if (res.ok) { setMessage('Seeded 20 demo staff members'); setMessageType('success'); }
      else { setMessage('Failed to seed staff'); setMessageType('error'); }
    }
    catch(_) { setMessage('Failed to seed staff'); setMessageType('error'); }
    finally { setSeedBusy(false); }
  }

  async function seedShifts() {
    try {
      setSeedBusy(true); setMessage(''); setMessageType('info');
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/seed/shifts', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ count: 40 })
      });
      if (res.ok) { setMessage('Seeded 40 demo shifts'); setMessageType('success'); }
      else { setMessage('Failed to seed shifts'); setMessageType('error'); }
    }
    catch(_) { setMessage('Failed to seed shifts'); setMessageType('error'); }
    finally { setSeedBusy(false); }
  }

  if (!isAdmin) {
    return (
      <ErrorMessage
        title="Access Denied"
        message="Admin privileges are required to access this page."
        severity="warning"
      />
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      <Typography variant="h5" sx={{ mb: 3 }}>Admin Panel</Typography>

      {message && (
        <Alert
          severity={messageType}
          onClose={() => setMessage('')}
          sx={{ mb: 3 }}
        >
          {message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Environment Settings */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6" sx={{ mb: 0.5 }}>Environment</Typography>
                <Typography variant="body2" color="text.secondary">
                  Mode: {demoMode === null ? '…' : (demoMode ? 'Demo (no external services)' : 'Live (DB/Redis integrations)')}
                </Typography>
              </Box>
              <StandardButton
                variant={demoMode ? 'outlined' : 'contained'}
                onClick={toggleDemoMode}
                loading={settingsBusy}
              >
                Switch to {demoMode ? 'Live' : 'Demo'}
              </StandardButton>
            </CardContent>
          </Card>
        </Grid>
        {/* User Search & Roles */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" sx={{ mb: 2 }}>User Search & Role Edit</Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    placeholder="Search by name, email, department, or role"
                    value={query}
                    onChange={(e)=>{ setQuery(e.target.value); filterUsers(e.target.value); }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: { xs: 1, md: 1.5 } }}>
                    {filtered.length} users
                  </Typography>
                </Grid>
              </Grid>

              <Grid container spacing={1}>
                {filtered.map(u => (
                  <Grid item xs={12} key={u.email}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap>{u.name || u.email}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>{u.email}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>Dept: {u.department || '—'}</Typography>
                      </Box>
                      <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel id={`role-${u.email}`}>Role</InputLabel>
                        <Select
                          labelId={`role-${u.email}`}
                          label="Role"
                          value={u.role || 'user'}
                          onChange={(e)=> updateUserRole(u.email, e.target.value)}
                          disabled={updatingUser === u.email}
                        >
                          {roles.length ? roles.map(r => (
                            <MenuItem key={r.name} value={r.name}>{r.name}</MenuItem>
                          )) : (
                            <>
                              <MenuItem value="admin">admin</MenuItem>
                              <MenuItem value="supervisor">supervisor</MenuItem>
                              <MenuItem value="user">user</MenuItem>
                            </>
                          )}
                        </Select>
                      </FormControl>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        {/* Demo Data Section */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" sx={{ mb: 3 }}>Demo Data Generator</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <StandardButton
                    variant="outlined"
                    onClick={seedRoles}
                    loading={busy}
                    fullWidth
                  >
                    Seed Default Roles
                  </StandardButton>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <StandardButton
                    variant="outlined"
                    onClick={seedStaff}
                    loading={seedBusy}
                    fullWidth
                  >
                    Seed 20 Rad Techs
                  </StandardButton>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <StandardButton
                    variant="outlined"
                    onClick={seedShifts}
                    loading={seedBusy}
                    fullWidth
                  >
                    Seed 40 Demo Shifts
                  </StandardButton>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Role Assignment Section */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" sx={{ mb: 3 }}>User Role Management</Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="User Email"
                    value={email}
                    onChange={e=>setEmail(e.target.value)}
                    fullWidth
                    placeholder="user@example.com"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    label="First Name (optional)"
                    value={firstName}
                    onChange={e=>setFirstName(e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    label="Last Name (optional)"
                    value={lastName}
                    onChange={e=>setLastName(e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel id="role-select-label">Role</InputLabel>
                    <Select
                      labelId="role-select-label"
                      label="Role"
                      value={roleName}
                      onChange={e=>setRoleName(e.target.value)}
                    >
                      {roles.length === 0 ? (
                        <MenuItem value="supervisor">supervisor</MenuItem>
                      ) : (
                        roles.map((r) => (
                          <MenuItem key={r.name} value={r.name}>{r.name}</MenuItem>
                        ))
                      )}
                      <MenuItem value="admin">admin</MenuItem>
                      <MenuItem value="supervisor">supervisor</MenuItem>
                      <MenuItem value="user">user</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth>
                    <InputLabel id="dept-select-label">Department (optional)</InputLabel>
                    <Select
                      labelId="dept-select-label"
                      label="Department (optional)"
                      value={department}
                      onChange={e=>setDepartment(e.target.value)}
                    >
                      <MenuItem value="">None</MenuItem>
                      {departments.map(d => (
                        <MenuItem key={d.id || d.code} value={d.id || d.code}>{d.name} ({d.code})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <StandardButton
                    variant="contained"
                    onClick={assignRole}
                    disabled={!email || !roleName}
                    loading={busy}
                    fullWidth={isMobile}
                  >
                    Assign Role
                  </StandardButton>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Admin;
