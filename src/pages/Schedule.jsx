import React, { useEffect, useMemo, useState } from 'react';
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField, Typography, Paper, Select, MenuItem, FormControl, InputLabel, Chip } from '@mui/material';
import { currentUserFromToken } from '../utils/auth';
import StandardButton from '../components/common/StandardButton';
import { LoadingSpinner, CardSkeleton } from '../components/common/LoadingState';
import { ErrorMessage } from '../components/common/ErrorState';
import { CalendarToday, AccessTime, Group, LocalHospital } from '@mui/icons-material';

const initialForm = {
  department_id: '',
  date: new Date().toISOString().slice(0,10),
  start_time: '07:00:00',
  end_time: '19:00:00',
  required_staff: 1,
  required_skills: '',
  notes: ''
};

const Schedule = () => {
  const me = useMemo(() => currentUserFromToken(), []);
  const canManage = me?.role === 'admin' || me?.role === 'supervisor';
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignShift, setAssignShift] = useState({ id: '', userId: '' });
  const [staff, setStaff] = useState([]);

  useEffect(() => { loadShifts(); }, []);
  useEffect(() => { (async () => { try { const { apiFetch } = await import('../utils/api'); const r = await apiFetch('/api/staff'); const d = await r.json(); setStaff(d.staff||[]);} catch(_){} })(); }, []);

  async function loadShifts() {
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/shifts');
      const data = await res.json();
      setShifts(data.shifts || []);
    } catch (e) {
      setShifts([]);
    } finally { setLoading(false); }
  }

  async function createShift() {
    try {
      setCreating(true);
      const { apiFetch } = await import('../utils/api');
      const body = { ...form, required_staff: Number(form.required_staff) || 1 };
      const res = await apiFetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data?.shift) setShifts(prev => [data.shift, ...prev]);
      setOpen(false);
      setForm(initialForm);
    } catch (e) {
      alert('Failed to create shift');
    } finally { setCreating(false); }
  }

  async function openShift(shiftId) {
    try {
      const { apiFetch } = await import('../utils/api');
      await apiFetch('/api/queue/open-shift', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shift_id: shiftId, reason: 'Staffing need', urgency_level: 3, expires_in_hours: 24 }) });
      alert('Open shift posted to FCFS queue');
    } catch (e) {
      alert('Failed to open shift');
    }
  }

  async function assignStaff() {
    if (!assignShift.id || !assignShift.userId) return;
    try { const { apiFetch } = await import('../utils/api'); await apiFetch('/api/shifts/assign', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ shift_id: assignShift.id, user_id: assignShift.userId }) }); setAssignOpen(false); await loadShifts(); } catch(_) { alert('Failed to assign'); }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Schedule</Typography>
      {canManage && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <StandardButton
            variant="contained"
            onClick={() => setOpen(true)}
            startIcon={<CalendarToday />}
          >
            Create Shift
          </StandardButton>
        </Box>
      )}
      {loading ? (
        <CardSkeleton count={4} />
      ) : shifts.length === 0 ? (
        <ErrorMessage
          severity="info"
          title="No shifts available"
          message="There are no shifts scheduled at this time."
        />
      ) : (
        <Grid container spacing={2}>
          {shifts.map((s) => (
            <Grid item xs={12} md={6} key={s.id}>
              <Paper sx={{
                p: 2.5,
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)'
                }
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <CalendarToday sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
                  <Typography variant="h6">{s.date || s.shift_date}</Typography>
                  <Chip
                    label={s.status || 'open'}
                    size="small"
                    color={s.status === 'filled' ? 'success' : 'warning'}
                    sx={{ ml: 'auto' }}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AccessTime sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
                  <Typography>{(s.start_time || s.start_datetime)} - {(s.end_time || s.end_datetime)}</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <LocalHospital sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
                  <Typography>{s.department_name || s.department_id || 'N/A'}</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Group sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
                  <Typography>
                    Required: {s.required_staff}
                    {s.current_staff && (
                      <Chip
                        label={`${s.current_staff} assigned`}
                        size="small"
                        color="primary"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                </Box>
                {s.assigned_staff && s.assigned_staff.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Assigned Staff:</Typography>
                    {s.assigned_staff.map((staff, idx) => (
                      <Typography key={idx} variant="body2" sx={{ ml: 1 }}>
                        • {staff.user_name || staff.name} ({staff.title})
                      </Typography>
                    ))}
                  </Box>
                )}
                {s.differential && (
                  <Typography variant="body2" color="primary">
                    <b>Differential:</b> {s.differential}%
                  </Typography>
                )}
                {canManage && (
                  <Box sx={{ 
                    mt: 2, 
                    display: 'flex', 
                    gap: 1,
                    flexDirection: { xs: 'column', sm: 'row' },
                    '& > *': { flex: { xs: 1, sm: 'initial' } }
                  }}>
                    <StandardButton
                      size="medium"
                      variant="outlined"
                      onClick={() => openShift(s.id)}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Open Shift (FCFS)
                    </StandardButton>
                    <StandardButton
                      size="medium"
                      variant="contained"
                      onClick={() => { setAssignShift({ id: s.id, userId: '' }); setAssignOpen(true); }}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Assign Staff
                    </StandardButton>
                  </Box>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        sx={{
          '& .MuiDialog-paper': {
            margin: { xs: 2, sm: 3 },
            width: { xs: 'calc(100% - 32px)', sm: '100%' },
            maxHeight: { xs: 'calc(100vh - 32px)', sm: '90vh' }
          }
        }}
      >
        <DialogTitle>Create Shift</DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Department"
                value={form.department_id}
                onChange={e=>setForm({ ...form, department_id:e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={form.date}
                onChange={e=>setForm({ ...form, date:e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Start Time"
                type="time"
                value={form.start_time}
                onChange={e=>setForm({ ...form, start_time:e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Time"
                type="time"
                value={form.end_time}
                onChange={e=>setForm({ ...form, end_time:e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Required Staff"
                type="number"
                value={form.required_staff}
                onChange={e=>setForm({ ...form, required_staff:e.target.value })}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Required Skills"
                placeholder="e.g., ICU, ECMO, Trauma (comma-separated)"
                value={form.required_skills}
                onChange={e=>setForm({ ...form, required_skills:e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                minRows={3}
                placeholder="Additional information about this shift..."
                value={form.notes}
                onChange={e=>setForm({ ...form, notes:e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <StandardButton onClick={() => setOpen(false)}>Cancel</StandardButton>
          <StandardButton
            variant="contained"
            onClick={createShift}
            loading={creating}
          >
            Create
          </StandardButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        fullWidth
        maxWidth="sm"
        sx={{
          '& .MuiDialog-paper': {
            margin: { xs: 2, sm: 3 },
            width: { xs: 'calc(100% - 32px)', sm: '100%' }
          }
        }}
      >
        <DialogTitle>Assign Staff</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="staff-select-label">Select Staff</InputLabel>
            <Select
              labelId="staff-select-label"
              label="Select Staff"
              value={assignShift.userId}
              onChange={e=>setAssignShift(prev => ({ ...prev, userId: e.target.value }))}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {staff.map(st => (
                <MenuItem key={st.id} value={st.id}>
                  {st.name || `${st.first_name} ${st.last_name}`} — {st.department_name || st.department_code}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <StandardButton onClick={() => setAssignOpen(false)}>Cancel</StandardButton>
          <StandardButton
            variant="contained"
            onClick={assignStaff}
            disabled={!assignShift.userId}
          >
            Assign
          </StandardButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Schedule;

