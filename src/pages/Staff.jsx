import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Select,
  TextField,
  Typography,
  Chip,
  Avatar,
  FormControl,
  InputLabel,
  InputAdornment,
  Alert
} from '@mui/material';
import { Search as SearchIcon, Person as PersonIcon } from '@mui/icons-material';
import { LoadingSpinner, CardSkeleton } from '../components/common/LoadingState';
import { ErrorMessage } from '../components/common/ErrorState';
import StandardButton from '../components/common/StandardButton';

const Staff = () => {
  const [staff, setStaff] = useState([]);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { loadStaff(); }, []);

  async function loadStaff() {
    try {
      setLoading(true);
      setError(null);
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/staff');
      const data = await res.json();
      setStaff(data.staff||[]);
    } catch(err){
      setError('Failed to load staff');
      // Use demo data as fallback
      setStaff([
        { id: 1, first_name: 'Emily', last_name: 'Rodriguez', title: 'RN', department_code: 'ED', department_name: 'Emergency', shift_preference: 'Night' },
        { id: 2, first_name: 'James', last_name: 'Wilson', title: 'RN', department_code: 'ICU', department_name: 'Intensive Care', shift_preference: 'Day' },
        { id: 3, first_name: 'Lisa', last_name: 'Martinez', title: 'RT', department_code: 'RAD', department_name: 'Radiology', shift_preference: 'Evening' },
        { id: 4, first_name: 'Michael', last_name: 'Chen', title: 'Supervisor', department_code: 'ED', department_name: 'Emergency', shift_preference: 'Day' }
      ]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => staff.filter(s =>
    (!q || (s.name||(`${s.first_name} ${s.last_name}`)).toLowerCase().includes(q.toLowerCase())) &&
    (!dept || s.department_code === dept)
  ), [staff, q, dept]);

  const depts = useMemo(() => Array.from(new Set(staff.map(s => s.department_code).filter(Boolean))), [staff]);

  if (loading) return <CardSkeleton count={3} />;

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" sx={{ mb: 3 }}>Staff Directory</Typography>

      {error && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Using demo data. {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            size="medium"
            label="Search Staff"
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Name or title..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth size="medium">
            <InputLabel id="dept-select">Department</InputLabel>
            <Select
              labelId="dept-select"
              label="Department"
              value={dept}
              onChange={e=>setDept(e.target.value)}
            >
              <MenuItem value="">All Departments</MenuItem>
              {depts.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <StandardButton
            variant="outlined"
            onClick={loadStaff}
            fullWidth
            sx={{ height: '56px' }}
          >
            Refresh
          </StandardButton>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        {filtered.map(s => (
          <Grid item xs={12} sm={6} lg={4} key={s.id}>
            <Card sx={{
              height: '100%',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: 3,
                transform: 'translateY(-2px)'
              }
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    {(s.name || `${s.first_name} ${s.last_name}`).split(' ').map(n => n[0]).join('').toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                      {s.name || `${s.first_name} ${s.last_name}`}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {s.title || 'Staff'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  <Chip
                    label={s.department_name || s.department_code || 'Unassigned'}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  {s.shift_preference && (
                    <Chip
                      label={s.shift_preference}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>

                {s.notes && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {s.notes}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
        {filtered.length === 0 && (
          <Grid item xs={12}>
            <Alert severity="info">
              No staff members found matching your search criteria.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Staff;
