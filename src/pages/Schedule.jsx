import { useEffect, useMemo, useState } from 'react';
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField, Typography, Paper, Select, MenuItem, FormControl, InputLabel, Chip, Switch, FormControlLabel, Slider, ToggleButtonGroup, ToggleButton, Fab } from '@mui/material';
import WeekTimeline from '../components/WeekTimeline';
import { currentUserFromToken } from '../utils/auth';
import StandardButton from '../components/common/StandardButton';
import { CardSkeleton } from '../components/common/LoadingState';
import { useNotification } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorState';
import { CalendarToday, AccessTime, Group, LocalHospital, Add as AddIcon } from '@mui/icons-material';
import { exportShiftsICS, exportShiftsCSV } from '../utils/export';

const initialForm = {
  department_id: '',
  date: new Date().toISOString().slice(0,10),
  // Use HH:mm for native time input compatibility
  start_time: '07:00',
  end_time: '19:00',
  required_staff: 1,
  required_skills: '',
  notes: ''
};

const Schedule = () => {
  const me = useMemo(() => currentUserFromToken(), []);
  // const canManageLocal = me?.role === 'admin' || me?.role === 'supervisor'; // Currently unused
  const [canManageServer, setCanManageServer] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [departments, setDepartments] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [creating, setCreating] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignShift, setAssignShift] = useState({ id: '', userId: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editShift, setEditShift] = useState(null);
  const [staff, setStaff] = useState([]);
  const { add: addToast } = useNotification();
  const [filterDept, setFilterDept] = useState(() => localStorage.getItem('schedule_filter_dept') || '');
  const [filterSkill, setFilterSkill] = useState(() => localStorage.getItem('schedule_filter_skill') || '');
  const [showOpenOnly, setShowOpenOnly] = useState(() => localStorage.getItem('schedule_filter_open') === '1');
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('schedule_filter_presets') || '[]'); } catch (e) { return []; }
  });
  const [viewMode, setViewMode] = useState('cards');
  const [dragOverShift, setDragOverShift] = useState('');

  const filteredShifts = useMemo(() => {
    return (shifts || [])
      .filter(s => !filterDept || (s.department_name === filterDept || s.department_id === filterDept))
      .filter(s => !filterSkill || ((s.required_skills || '').toLowerCase().includes(filterSkill.toLowerCase())))
      .filter(s => !showOpenOnly || (String(s.status || '').toLowerCase() === 'open'));
  }, [shifts, filterDept, filterSkill, showOpenOnly]);

  useEffect(() => { loadShifts(); }, [loadShifts]);
  // Probe server to see if user has admin/supervisor permissions (more authoritative in production)
  useEffect(() => { (async () => {
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/admin/status');
      if (res.ok) setCanManageServer(true);
    } catch (_) { /* ignore */ }
  })(); }, []);
  // Only trust server authorization in production to prevent showing buttons users can't use
  // TEMPORARY: Always show button for testing
  const canManage = true; // TODO: Revert after fixing auth
  // const canManage = process.env.NODE_ENV === 'development'
  //   ? (canManageLocal || canManageServer)  // Allow local hints in dev
  //   : canManageServer;                       // Only trust server in prod
  useEffect(() => { (async () => { try { const { apiFetch } = await import('../utils/api'); const r = await apiFetch('/api/staff'); const d = await r.json(); setStaff(d.staff||[]);} catch(_){ /* ignore */ } })(); }, []);

  // Load lookup lists when create dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { apiFetch } = await import('../utils/api');
        const [dr, hr] = await Promise.all([
          apiFetch('/api/departments'),
          apiFetch('/api/hospitals')
        ]);
        const dd = await dr.json().catch(() => ({ departments: [] }));
        const hh = await hr.json().catch(() => ({ hospitals: [] }));
        setDepartments(dd.departments || []);
        setHospitals(hh.hospitals || []);
      } catch (_) {
        setDepartments([]);
        setHospitals([]);
      }
    })();
  }, [open]);

  async function loadShifts() {
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/shifts');
      if (!res.ok) {
        // Preserve current list on transient error
        const err = await res.json().catch(() => ({ error: 'Failed to load shifts' }));
        addToast({ severity: 'error', message: err.error || 'Failed to load shifts' });
        return;
      }
      const data = await res.json();
      setShifts(data.shifts || []);
    } catch (e) {
      // Preserve current list and surface error
      addToast({ severity: 'error', message: 'Failed to load shifts' });
    } finally { setLoading(false); }
  }

  async function createShift() {
    try {
      setCreating(true);
      
      const { apiFetch } = await import('../utils/api');
      // Ensure HH:mm:ss for server if inputs are HH:mm
      const fmt = (t) => {
        if (!t) return t;
        return t.length === 5 ? `${t}:00` : t;
      };
      const body = { 
        ...form,
        start_time: fmt(form.start_time),
        end_time: fmt(form.end_time),
        required_staff: Number(form.required_staff) || 1 
      };
      const res = await apiFetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      
      if (!res.ok) {
        const status = res.status;
        const code = res.headers.get('X-Error-Code') || '';
        const error = await res.json().catch(() => ({ message: 'Failed to create shift' }));
        let msg = error.message || error.error || 'Failed to create shift';
        if (status === 403) msg = 'You do not have permission to create shifts';
        else if (status === 404) msg = 'API route not found (check IIS proxy/web.config)';
        else if (status === 503) msg = 'Service unavailable (database not ready)';
        if (code && !msg.includes(code)) msg += ` [${code}]`;
        throw new Error(msg);
      }
      
      const data = await res.json();
      if (data?.shift) {
        setShifts(prev => [data.shift, ...prev]);
        addToast({ severity: 'success', message: 'Shift created successfully' });
        setOpen(false);
        setForm(initialForm);
      }
    } catch (e) {
      console.error('Error creating shift:', e);
      addToast({ severity: 'error', message: e.message || 'Failed to create shift' });
    } finally { setCreating(false); }
  }

  async function openShift(shiftId) {
    try {
      const { apiFetch } = await import('../utils/api');
      await apiFetch('/api/queue/open-shift', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shift_id: shiftId, reason: 'Staffing need', urgency_level: 3, expires_in_hours: 24 }) });
      addToast({ severity: 'success', message: 'Open shift posted to FCFS queue' });
    } catch (e) {
      addToast({ severity: 'error', message: 'Failed to open shift' });
    }
  }

  async function assignStaff() {
    if (!assignShift.id || !assignShift.userId) return;
    try {
      const { apiFetch } = await import('../utils/api');
      await apiFetch('/api/shifts/assign', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ shift_id: assignShift.id, user_id: assignShift.userId }) });
      setAssignOpen(false);
      addToast({ severity: 'success', message: 'Staff assigned' });
      await loadShifts();
    } catch(_) {
      addToast({ severity: 'error', message: 'Failed to assign staff' });
    }
  }

  async function handleDropAssign(shiftId, userId) {
    if (!shiftId || !userId) return;
    try {
      // Optimistic UI update
      const staffMember = staff.find(s => s.id === userId);
      let becameFilled = false;
      setShifts(prev => prev.map(s => {
        if (s.id !== shiftId) return s;
        const existingAssigned = Array.isArray(s.assigned_staff) ? s.assigned_staff.slice() : [];
        const already = existingAssigned.some(a => a === userId || a?.user_id === userId);
        const updatedAssigned = already ? existingAssigned : [
          ...existingAssigned,
          {
            user_id: userId,
            user_name: staffMember?.name || `${staffMember?.first_name || ''} ${staffMember?.last_name || ''}`.trim() || 'Assigned',
            title: staffMember?.title || ''
          }
        ];
        const current = Math.max(updatedAssigned.length, Number(s.current_staff || 0));
        const required = Number(s.required_staff || 1);
        const newStatus = current >= required ? 'filled' : (s.status || 'open');
        becameFilled = newStatus === 'filled' && (s.status !== 'filled');
        return { ...s, assigned_staff: updatedAssigned, current_staff: current, status: newStatus };
      }));

      const { apiFetch } = await import('../utils/api');
      await apiFetch('/api/shifts/assign', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ shift_id: shiftId, user_id: userId }) });
      addToast({ severity: 'success', message: 'Staff assigned' });
      if (becameFilled && showOpenOnly) {
        addToast({ severity: 'info', message: 'Shift filled and hidden by Open filter' });
      }
      // Refresh in background to sync state
      await loadShifts();
    } catch(_) {
      addToast({ severity: 'error', message: 'Failed to assign staff' });
      // Re-sync to undo optimistic update if server failed
      await loadShifts();
    } finally {
      setDragOverShift('');
    }
  }

  async function saveEdit() {
    if (!editShift) return;
    try {
      const { apiFetch } = await import('../utils/api');
      const body = {
        date: editShift.date || editShift.shift_date,
        start_time: editShift.start_time,
        end_time: editShift.end_time,
        required_staff: Number(editShift.required_staff) || 1,
        status: editShift.status || 'open',
        department_id: editShift.department_id
      };
      await apiFetch(`/api/shifts/${editShift.id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      addToast({ severity: 'success', message: 'Shift updated' });
      setEditOpen(false); setEditShift(null); await loadShifts();
    } catch(_) {
      addToast({ severity: 'error', message: 'Failed to update shift' });
    }
  }

  const toMinutes = (t) => {
    if (!t) return 0;
    if (typeof t === 'string' && t.includes('T')) {
      const d = new Date(t); return d.getHours()*60 + d.getMinutes();
    }
    const [hh, mm] = (t || '00:00:00').split(':');
    return (parseInt(hh,10)||0)*60 + (parseInt(mm,10)||0);
  };
  const toTimeStr = (m) => {
    const hh = Math.floor(m/60)%24; const mm = m%60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`;
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ flex: 1 }}>Schedule</Typography>
        {canManage && (
          <StandardButton
            variant="contained"
            color="primary"
            onClick={() => setOpen(true)}
            startIcon={<CalendarToday />}
            data-testid="create-shift-button"
            ariaLabel="Create Shift"
          >
            Create Shift
          </StandardButton>
        )}
      </Box>
      {/* Filters */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Department</InputLabel>
          <Select label="Department" value={filterDept} onChange={(e)=>{ setFilterDept(e.target.value); localStorage.setItem('schedule_filter_dept', e.target.value); }}>
            <MenuItem value=""><em>All</em></MenuItem>
            {Array.from(new Set(shifts.map(s => s.department_name || s.department_id).filter(Boolean))).map(d => (
              <MenuItem key={d} value={d}>{d}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Skill contains"
          placeholder="e.g., ICU, ACLS"
          value={filterSkill}
          onChange={(e)=>{ setFilterSkill(e.target.value); localStorage.setItem('schedule_filter_skill', e.target.value); }}
        />
        <FormControlLabel
          control={<Switch checked={showOpenOnly} onChange={(e)=>{ setShowOpenOnly(e.target.checked); localStorage.setItem('schedule_filter_open', e.target.checked ? '1' : '0'); }} />}
          label="Open shifts only"
        />
        <TextField size="small" placeholder="Save preset name" value={presetName} onChange={(e)=>setPresetName(e.target.value)} />
        <StandardButton size="small" variant="outlined" onClick={() => {
          if (!presetName.trim()) return;
          const p = { name: presetName.trim(), dept: filterDept, skill: filterSkill, open: showOpenOnly };
          const next = [p, ...presets.filter(x => x.name !== p.name)].slice(0, 10);
          setPresets(next);
          localStorage.setItem('schedule_filter_presets', JSON.stringify(next));
          setPresetName('');
          addToast({ severity: 'success', message: 'Preset saved' });
        }}>Save Preset</StandardButton>
        {presets.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Load Preset</InputLabel>
            <Select label="Load Preset" value="" onChange={(e)=>{
              const p = presets.find(x => x.name === e.target.value);
              if (!p) return;
              setFilterDept(p.dept); localStorage.setItem('schedule_filter_dept', p.dept || '');
              setFilterSkill(p.skill); localStorage.setItem('schedule_filter_skill', p.skill || '');
              setShowOpenOnly(!!p.open); localStorage.setItem('schedule_filter_open', p.open ? '1' : '0');
            }}>
              {presets.map(p => <MenuItem key={p.name} value={p.name}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}
      </Box>
      {/* Floating action button to always expose Create Shift */}
      {canManage && (
        <Fab
          color="primary"
          aria-label="Create Shift"
          onClick={() => setOpen(true)}
          sx={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1300 }}
        >
          <AddIcon />
        </Fab>
      )}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {canManage && (
          <StandardButton
            variant="contained"
            onClick={() => setOpen(true)}
            startIcon={<CalendarToday />}
            ariaLabel="Create Shift"
          >
            Create Shift
          </StandardButton>
        )}
        <Typography variant="body2" sx={{ alignSelf: 'center' }}>
          Drag a staff member onto a shift to assign
        </Typography>
        <StandardButton variant="outlined" onClick={() => {
            const filtered = shifts
              .filter(s => !filterDept || (s.department_name === filterDept || s.department_id === filterDept))
              .filter(s => !filterSkill || ((s.required_skills || '').toLowerCase().includes(filterSkill.toLowerCase())))
              .filter(s => !showOpenOnly || (String(s.status || '').toLowerCase() === 'open'));
            exportShiftsICS(filtered, 'shiftwise_shifts.ics');
          }}>Export ICS</StandardButton>
        <StandardButton variant="outlined" onClick={() => {
            const filtered = shifts
              .filter(s => !filterDept || (s.department_name === filterDept || s.department_id === filterDept))
              .filter(s => !filterSkill || ((s.required_skills || '').toLowerCase().includes(filterSkill.toLowerCase())))
              .filter(s => !showOpenOnly || (String(s.status || '').toLowerCase() === 'open'));
            exportShiftsCSV(filtered, 'shiftwise_shifts.csv');
          }}>Export CSV</StandardButton>
      </Box>
      {canManage && (
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {staff.slice(0, 20).map(st => (
            <Chip
              key={st.id}
              label={st.name || `${st.first_name} ${st.last_name}`}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/plain', st.id); }}
              sx={{ cursor: 'grab' }}
            />
          ))}
          {showOpenOnly && (filteredShifts.length === 0) && (
            <Chip size="small" label="Open filter hides results" color="warning" />
          )}
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">View</Typography>
        <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(e,v)=> v && setViewMode(v)}>
          <ToggleButton value="cards">Cards</ToggleButton>
          <ToggleButton value="timeline">Timeline</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <CardSkeleton count={4} />
      ) : shifts.length === 0 ? (
        <ErrorMessage severity="info" title="No shifts available" message="There are no shifts scheduled at this time." />
      ) : viewMode === 'timeline' ? (
        filteredShifts.length === 0 ? (
          <ErrorMessage severity="info" title="No shifts match your filters" message="Try clearing filters or disabling 'Open shifts only'." />
        ) : (
          <WeekTimeline
            shifts={filteredShifts}
            onShiftUpdate={(u, preview) => {
              if (preview) return; // only commit on mouseup
              setEditShift({ id: u.id, date: u.date, start_time: u.start_time, end_time: u.end_time, required_staff: 1, status: 'open' });
              saveEdit();
            }}
          />
        )
      ) : (
        filteredShifts.length === 0 ? (
          <ErrorMessage severity="info" title="No shifts match your filters" message="Try clearing filters or disabling 'Open shifts only'." />
        ) : (
          <Grid container spacing={2}>
            {filteredShifts.map((s) => (
              <Grid item xs={12} md={6} key={s.id}>
                <Paper
                  onDragOver={(e)=>{ e.preventDefault(); setDragOverShift(s.id); }}
                  onDragLeave={()=> setDragOverShift(prev => prev===s.id ? '' : prev)}
                  onDrop={(e)=> { e.preventDefault(); const uid = e.dataTransfer.getData('text/plain'); handleDropAssign(s.id, uid); }}
                  sx={{
                    p: 2.5,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)'
                  },
                  outline: dragOverShift === s.id ? '2px dashed #2563eb' : 'none'
                }}
                >
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
                      {typeof s.current_staff !== 'undefined' && (
                        <Chip
                          label={`${s.current_staff} assigned`}
                          size="small"
                          color="primary"
                          sx={{ ml: 1 }}
                        />
                      )}
                      {typeof s.current_staff === 'undefined' && Array.isArray(s.assigned_staff) && (
                        <Chip
                          label={`${s.assigned_staff.length} assigned`}
                          size="small"
                          color="primary"
                          sx={{ ml: 1 }}
                        />
                      )}
                      <Chip
                        label={`Assigned: ${(typeof s.current_staff !== 'undefined' ? s.current_staff : (Array.isArray(s.assigned_staff) ? s.assigned_staff.length : 0))} / ${s.required_staff}`}
                        size="small"
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                  </Box>
                  {/* Rest of card actions remain below unchanged */}
                </Paper>
              </Grid>
            ))}
          </Grid>
        )
      )}
        <WeekTimeline
          shifts={shifts
            .filter(s => !filterDept || (s.department_name === filterDept || s.department_id === filterDept))
            .filter(s => !filterSkill || ((s.required_skills || '').toLowerCase().includes(filterSkill.toLowerCase())))
            .filter(s => !showOpenOnly || (String(s.status || '').toLowerCase() === 'open'))}
          onShiftUpdate={(u, preview) => {
            if (preview) return; // only commit on mouseup
            setEditShift({ id: u.id, date: u.date, start_time: u.start_time, end_time: u.end_time, required_staff: 1, status: 'open' });
            saveEdit();
          }}
        />
      ) : (
        <Grid container spacing={2}>
          {shifts
            .filter(s => !filterDept || (s.department_name === filterDept || s.department_id === filterDept))
            .filter(s => !filterSkill || ((s.required_skills || '').toLowerCase().includes(filterSkill.toLowerCase())))
            .filter(s => !showOpenOnly || (String(s.status || '').toLowerCase() === 'open'))
            .map((s) => (
            <Grid item xs={12} md={6} key={s.id}>
              <Paper
                onDragOver={(e)=>{ e.preventDefault(); setDragOverShift(s.id); }}
                onDragLeave={()=> setDragOverShift(prev => prev===s.id ? '' : prev)}
                onDrop={(e)=> { e.preventDefault(); const uid = e.dataTransfer.getData('text/plain'); handleDropAssign(s.id, uid); }}
                sx={{
                  p: 2.5,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)'
                },
                outline: dragOverShift === s.id ? '2px dashed #2563eb' : 'none'
              }}
              >
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
                    {/* Time range slider */}
                    <Box sx={{ width: '100%', px: 1 }}>
                      <Typography variant="caption" color="text.secondary">Adjust Time</Typography>
                      <Slider
                        size="small"
                        value={[toMinutes(s.start_time || s.start_datetime), Math.max(toMinutes(s.start_time || s.start_datetime)+30, toMinutes(s.end_time || s.end_datetime))]}
                        min={0}
                        max={24*60}
                        step={15}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v)=>`${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`}
                        onChangeCommitted={(_, val)=>{
                          const [a,b] = val;
                          setEditShift({ id: s.id, date: s.date || s.shift_date, start_time: toTimeStr(a), end_time: toTimeStr(b), required_staff: s.required_staff, status: s.status, department_id: s.department_id });
                          saveEdit();
                        }}
                      />
                    </Box>
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
                    <StandardButton
                      size="medium"
                      variant="outlined"
                      onClick={() => { setEditShift({ id: s.id, date: s.date || s.shift_date, start_time: s.start_time, end_time: s.end_time, required_staff: s.required_staff, status: s.status, department_id: s.department_id }); setEditOpen(true); }}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Edit
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
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  label="Department"
                  value={form.department_id}
                  onChange={e=>setForm({ ...form, department_id:e.target.value })}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {departments.map(d => (
                    <MenuItem key={d.id || d.department_id} value={d.id || d.department_id}>
                      {d.name || d.department_name} {d.code ? `(${d.code})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Hospital (optional)</InputLabel>
                <Select
                  label="Hospital (optional)"
                  value={form.hospital_id || ''}
                  onChange={e=>setForm({ ...form, hospital_id:e.target.value })}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {hospitals.map(h => (
                    <MenuItem key={h.hospital_id} value={h.hospital_id}>
                      {h.hospital_name} {h.code ? `(${h.code})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
                onChange={e=>setForm({ ...form, start_time:(e.target.value || '').slice(0,5) })}
                inputProps={{ step: 60 }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Time"
                type="time"
                value={form.end_time}
                onChange={e=>setForm({ ...form, end_time:(e.target.value || '').slice(0,5) })}
                inputProps={{ step: 60 }}
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
            disabled={creating}
            ariaLabel="Create Shift"
          >
            Create
          </StandardButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditShift(null); }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit Shift</DialogTitle>
        <DialogContent>
          {editShift && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField fullWidth label="Date" type="date" value={editShift.date} onChange={(e)=>setEditShift(prev=>({ ...prev, date:e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Start Time" type="time" value={editShift.start_time} onChange={(e)=>setEditShift(prev=>({ ...prev, start_time:e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="End Time" type="time" value={editShift.end_time} onChange={(e)=>setEditShift(prev=>({ ...prev, end_time:e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Required Staff" type="number" value={editShift.required_staff} onChange={(e)=>setEditShift(prev=>({ ...prev, required_staff:e.target.value }))} inputProps={{ min: 1 }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Status" value={editShift.status || 'open'} onChange={(e)=>setEditShift(prev=>({ ...prev, status:e.target.value }))} />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <StandardButton onClick={() => { setEditOpen(false); setEditShift(null); }}>Cancel</StandardButton>
          <StandardButton variant="contained" onClick={saveEdit}>Save</StandardButton>
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
