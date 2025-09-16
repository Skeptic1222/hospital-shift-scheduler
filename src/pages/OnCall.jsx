import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Select,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Chip,
  Avatar,
  Alert,
  Paper,
  Divider,
  LinearProgress,
  IconButton
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocalHospital as HospitalIcon,
  Today as TodayIcon,
  NavigateBefore,
  NavigateNext,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import StandardButton from '../components/common/StandardButton';
import { CardSkeleton } from '../components/common/LoadingState';
import { ErrorMessage } from '../components/common/ErrorState';
import { useResponsive } from '../hooks/useResponsive';

const DEPARTMENTS = [
  { code: 'ED', name: 'Emergency Department', color: '#ef4444', critical: true },
  { code: 'ICU', name: 'Intensive Care Unit', color: '#3b82f6', critical: true },
  { code: 'OR', name: 'Operating Room', color: '#10b981', critical: true },
  { code: 'CathLab', name: 'Cardiac Cath Lab', color: '#f59e0b', critical: true },
  { code: 'CT', name: 'CT Scan', color: '#8b5cf6' },
  { code: 'MR', name: 'MRI', color: '#ec4899' },
  { code: 'XRay', name: 'X-Ray', color: '#06b6d4' },
  { code: 'Ultrasound', name: 'Ultrasound', color: '#84cc16' },
  { code: 'StatLab', name: 'Stat Lab', color: '#f97316' },
  { code: 'EPLab', name: 'EP Lab', color: '#6366f1' },
  { code: 'Infusion', name: 'Infusion Center', color: '#14b8a6' }
];

const OnCall = () => {
  useResponsive();
  const [view, setView] = useState('day');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignments, setAssignments] = useState({});
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch(`/api/oncall?view=${view}&date=${date}`);
      const data = await res.json();

      setAssignments(data.assignments || {});
    } catch (err) {
      setError('Failed to load on-call assignments');
      setAssignments({});
    } finally {
      setLoading(false);
    }
  }, [view, date]); // Removed 'staff' - not needed as dependency

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  async function loadStaff() {
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/staff');
      const data = await res.json();
      setStaff(data.staff || []);
    } catch (err) {
      console.error('Failed to load staff:', err);
      setStaff([]);
    }
  }

  // loadAssignments defined via useCallback below

  async function setOnCall(department, userId) {
    try {
      setSaving(true);
      const { apiFetch } = await import('../utils/api');
      await apiFetch('/api/oncall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, department, userId })
      });

      // Update local state
      const selectedStaff = staff.find(s => s.id === userId);
      if (selectedStaff) {
        setAssignments(prev => ({
          ...prev,
          [department]: {
            userId,
            userName: `${selectedStaff.first_name} ${selectedStaff.last_name}`,
            phone: selectedStaff.phone,
            email: selectedStaff.email,
            isPrimary: true
          }
        }));
      } else {
        setAssignments(prev => {
          const newAssignments = { ...prev };
          delete newAssignments[department];
          return newAssignments;
        });
      }
    } catch (err) {
      console.error('Failed to set on-call:', err);
    } finally {
      setSaving(false);
    }
  }

  const staffByDept = useMemo(() => {
    const map = {};
    DEPARTMENTS.forEach(dept => {
      map[dept.code] = staff.filter(s => s.department_code === dept.code);
    });
    // Add all staff to each department for demo flexibility
    DEPARTMENTS.forEach(dept => {
      if (map[dept.code].length === 0) {
        map[dept.code] = staff;
      }
    });
    return map;
  }, [staff]);

  const changeDate = (days) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    setDate(newDate.toISOString().slice(0, 10));
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading && Object.keys(assignments).length === 0) {
    return <CardSkeleton count={4} />;
  }

  if (error && Object.keys(assignments).length === 0) {
    return (
      <ErrorMessage
        title="Unable to load on-call schedule"
        message={error}
        onRetry={loadAssignments}
      />
    );
  }

  const criticalDepts = DEPARTMENTS.filter(d => d.critical);
  const regularDepts = DEPARTMENTS.filter(d => !d.critical);

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" sx={{ mb: 3 }}>On-Call Schedule</Typography>

      {/* Date Navigation */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <IconButton onClick={() => changeDate(-1)}>
              <NavigateBefore />
            </IconButton>
            <TextField
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              size="small"
              sx={{ mx: 1 }}
            />
            <IconButton onClick={() => changeDate(1)}>
              <NavigateNext />
            </IconButton>
          </Box>

          <Typography variant="body1" sx={{ flex: 2, textAlign: 'center' }}>
            <TodayIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            {formatDate(date)}
          </Typography>

          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 120 } }}>
            <InputLabel>View</InputLabel>
            <Select value={view} onChange={e => setView(e.target.value)} label="View">
              <MenuItem value="day">Day</MenuItem>
              <MenuItem value="week">Week</MenuItem>
              <MenuItem value="month">Month</MenuItem>
            </Select>
          </FormControl>

          <StandardButton
            variant="outlined"
            onClick={loadAssignments}
            loading={loading}
          >
            Refresh
          </StandardButton>
        </Box>
      </Paper>

      {saving && <LinearProgress sx={{ mb: 2 }} />}

      {/* Critical Departments Alert */}
      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <WarningIcon sx={{ verticalAlign: 'middle', mr: 1, fontSize: 20 }} />
          Critical departments must have 24/7 on-call coverage. Ensure all positions are filled.
        </Typography>
      </Alert>

      {/* Critical Departments */}
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <HospitalIcon sx={{ mr: 1 }} />
        Critical Departments
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {criticalDepts.map(dept => (
          <Grid item xs={12} md={6} lg={4} key={dept.code}>
            <Card sx={{
              borderLeft: `4px solid ${dept.color}`,
              height: '100%',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: 3,
                transform: 'translateY(-2px)'
              }
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: dept.color, mr: 2 }}>
                    {dept.code.slice(0, 2)}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6">{dept.name}</Typography>
                    <Chip
                      label={assignments[dept.code] ? 'Covered' : 'Not Covered'}
                      size="small"
                      color={assignments[dept.code] ? 'success' : 'error'}
                    />
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>On-Call Staff</InputLabel>
                  <Select
                    value={assignments[dept.code]?.userId || ''}
                    onChange={e => setOnCall(dept.code, e.target.value)}
                    disabled={saving}
                    label="On-Call Staff"
                  >
                    <MenuItem value="">
                      <em>Unassigned</em>
                    </MenuItem>
                    {(staffByDept[dept.code] || []).map(s => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name || `${s.first_name} ${s.last_name}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {assignments[dept.code] && (
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <PersonIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        {assignments[dept.code].userName}
                      </Typography>
                    </Box>
                    {assignments[dept.code].phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PhoneIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {assignments[dept.code].phone}
                        </Typography>
                      </Box>
                    )}
                    {assignments[dept.code].email && (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <EmailIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2" noWrap>
                          {assignments[dept.code].email}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Regular Departments */}
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <ScheduleIcon sx={{ mr: 1 }} />
        Other Departments
      </Typography>
      <Grid container spacing={2}>
        {regularDepts.map(dept => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={dept.code}>
            <Card sx={{
              borderTop: `3px solid ${dept.color}`,
              height: '100%'
            }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {dept.name}
                </Typography>

                <FormControl fullWidth size="small">
                  <Select
                    value={assignments[dept.code]?.userId || ''}
                    onChange={e => setOnCall(dept.code, e.target.value)}
                    disabled={saving}
                    displayEmpty
                  >
                    <MenuItem value="">
                      <em>Unassigned</em>
                    </MenuItem>
                    {(staffByDept[dept.code] || []).map(s => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name || `${s.first_name} ${s.last_name}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {assignments[dept.code] && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {assignments[dept.code].userName}
                    </Typography>
                    {assignments[dept.code].phone && (
                      <Typography variant="caption" display="block">
                        📞 {assignments[dept.code].phone}
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Summary Stats */}
      <Paper sx={{ p: 3, mt: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Coverage Summary</Typography>
        <Grid container spacing={3}>
          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {Object.keys(assignments).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Departments Covered
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {criticalDepts.filter(d => assignments[d.code]).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Critical Covered
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="error.main">
                {DEPARTMENTS.length - Object.keys(assignments).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Not Covered
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {Math.round((Object.keys(assignments).length / DEPARTMENTS.length) * 100)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Coverage Rate
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default OnCall;
