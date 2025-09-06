import React, { useEffect, useState } from 'react';
import { Avatar, Box, Card, CardContent, Grid, TextField, Typography, Chip, Divider, InputAdornment } from '@mui/material';
import StandardButton from '../components/common/StandardButton';
import { LoadingSpinner } from '../components/common/LoadingState';
import { ErrorMessage } from '../components/common/ErrorState';
import { Person, Email, CalendarMonth, EventAvailable, Description } from '@mui/icons-material';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeOff, setTimeOff] = useState({ start_date: '', end_date: '', reason: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/users/profile');
      const data = await res.json();
      setProfile(data);
    } catch (_) {}
    finally { setLoading(false); }
  }

  async function requestTimeOff() {
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/users/timeoff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(timeOff) });
      if (res.ok) {
        alert('Time off requested');
        setTimeOff({ start_date: '', end_date: '', reason: '' });
      } else {
        alert('Failed to request time off');
      }
    } catch (_) { alert('Failed to request time off'); }
  }

  if (loading) return <LoadingSpinner message="Loading profile..." />;
  if (!profile) return (
    <ErrorMessage
      title="Unable to load profile"
      message="There was an error loading your profile information. Please try again."
      onRetry={load}
    />
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Profile</Typography>
      <Card sx={{
        mb: 3,
        borderRadius: 2,
        boxShadow: 2
      }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item>
              <Avatar
                src={profile.picture}
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'primary.main',
                  fontSize: '2rem'
                }}
              >
                {!profile.picture && (profile.name || profile.first_name || 'U')[0].toUpperCase()}
              </Avatar>
            </Grid>
            <Grid item xs>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Person sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="h6">
                  {profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Email sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
                <Typography color="text.secondary">{profile.email}</Typography>
              </Box>
              {profile.role && (
                <Chip
                  label={profile.role}
                  size="small"
                  color="primary"
                  sx={{ mt: 1 }}
                />
              )}
            </Grid>
          </Grid>

          {(profile.department || profile.shift_preference) && (
            <>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                {profile.department && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Department</Typography>
                    <Typography variant="body1">{profile.department}</Typography>
                  </Grid>
                )}
                {profile.shift_preference && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Shift Preference</Typography>
                    <Typography variant="body1">{profile.shift_preference}</Typography>
                  </Grid>
                )}
              </Grid>
            </>
          )}
        </CardContent>
      </Card>

      <Card sx={{
        borderRadius: 2,
        boxShadow: 2
      }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <CalendarMonth sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Request Time Off</Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={timeOff.start_date}
                onChange={e=>setTimeOff({ ...timeOff, start_date:e.target.value })}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EventAvailable sx={{ fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={timeOff.end_date}
                onChange={e=>setTimeOff({ ...timeOff, end_date:e.target.value })}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EventAvailable sx={{ fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reason"
                multiline
                minRows={3}
                placeholder="Please provide a reason for your time off request..."
                value={timeOff.reason}
                onChange={e=>setTimeOff({ ...timeOff, reason:e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                      <Description sx={{ fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <StandardButton
              variant="contained"
              onClick={requestTimeOff}
              disabled={!timeOff.start_date || !timeOff.end_date || !timeOff.reason}
            >
              Submit Request
            </StandardButton>
            <StandardButton
              variant="outlined"
              onClick={() => setTimeOff({ start_date: '', end_date: '', reason: '' })}
              disabled={!timeOff.start_date && !timeOff.end_date && !timeOff.reason}
            >
              Clear
            </StandardButton>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Profile;
