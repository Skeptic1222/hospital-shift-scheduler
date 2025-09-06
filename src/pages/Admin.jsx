import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Divider,
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
import { LoadingSpinner } from '../components/common/LoadingState';
import { ErrorMessage } from '../components/common/ErrorState';
import { useResponsive } from '../hooks/useResponsive';

const Admin = () => {
  const me = useMemo(() => currentUserFromToken(), []);
  const isAdmin = me?.role === 'admin';
  const { isMobile } = useResponsive();
  const [roles, setRoles] = useState([]);
  const [email, setEmail] = useState('');
  const [roleName, setRoleName] = useState('supervisor');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [seedBusy, setSeedBusy] = useState(false);
  const [messageType, setMessageType] = useState('info');

  useEffect(() => { if (isAdmin) loadRoles(); }, [isAdmin]);

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
      const res = await apiFetch('/api/admin/users/assign-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, roleName }) });
      if (res.ok) { setMessage('Role assigned successfully'); setMessageType('success'); setEmail(''); }
      else { setMessage('Failed to assign role'); setMessageType('error'); }
    } catch (_) { setMessage('Failed to assign role'); setMessageType('error'); }
    finally { setBusy(false); }
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
                <Grid item xs={12} sm={6} md={5}>
                  <TextField
                    label="User Email"
                    value={email}
                    onChange={e=>setEmail(e.target.value)}
                    fullWidth
                    placeholder="user@example.com"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
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
                <Grid item xs={12} md={3}>
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
