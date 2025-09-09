import { useState } from 'react';
import { Box, Card, CardContent, Grid, TextField, Typography, Chip, Alert } from '@mui/material';
import StandardButton from '../components/common/StandardButton';
import { LoadingSpinner } from '../components/common/LoadingState';
// import { ErrorMessage } from '../components/common/ErrorState';
import { Queue, CheckCircle, Cancel, AccessTime, Person } from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';

const ShiftQueue = () => {
  const [openShiftId, setOpenShiftId] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const { add: addToast } = useNotification();

  async function loadStatus() {
    if (!openShiftId) return;
    try {
      setLoading(true);
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch(`/api/queue/status/${encodeURIComponent(openShiftId)}`);
      const data = await res.json();
      setStatus(data);
    } catch (_) { setStatus(null); }
    finally { setLoading(false); }
  }

  async function respond(queueEntryId, response) {
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/queue/respond', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ queue_entry_id: queueEntryId, response })
      });
      if (res.ok) {
        // Better feedback than alert
        loadStatus();
        addToast({ severity: response === 'accepted' ? 'success' : 'info', message: `Response: ${response}` });
      } else {
        addToast({ severity: 'error', message: 'Failed to respond to queue entry' });
      }
    } catch (err) {
      addToast({ severity: 'error', message: 'Error responding to queue' });
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Shift Queue</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Open Shift ID"
          value={openShiftId}
          onChange={e=>setOpenShiftId(e.target.value)}
          sx={{
            minWidth: { xs: '100%', sm: 320 },
            flex: { sm: '0 1 auto' }
          }}
          placeholder="Enter shift ID to check queue status"
        />
        <StandardButton
          variant="contained"
          onClick={loadStatus}
          disabled={!openShiftId}
          loading={loading}
          startIcon={<Queue />}
        >
          Check Status
        </StandardButton>
      </Box>
      {loading && <LoadingSpinner message="Loading queue status..." />}

      {!loading && status && (
        <Card sx={{
          borderRadius: 2,
          boxShadow: 2
        }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ flex: 1 }}>Queue Status</Typography>
              <Chip
                label={status.status}
                color={status.status === 'active' ? 'success' : 'default'}
                size="small"
              />
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Queue Size: <strong>{status.queueSize ?? (status.entries?.length || 0)}</strong> staff members
              </Typography>
            </Alert>
            <Grid container spacing={2}>
              {(status.entries || []).length === 0 ? (
                <Grid item xs={12}>
                  <Alert severity="info">
                    No entries in the queue for this shift.
                  </Alert>
                </Grid>
              ) : (
                (status.entries || []).map((e) => (
                  <Grid item xs={12} md={6} key={e.id}>
                    <Card variant="outlined" sx={{
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: 3,
                        transform: 'translateY(-2px)'
                      }
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                          <Person sx={{ mr: 1, color: 'text.secondary' }} />
                          <Typography variant="subtitle1" sx={{ flex: 1 }}>
                            {e.email || e.user_id}
                          </Typography>
                          <Chip
                            label={`#${e.queue_position}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <AccessTime sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />
                          <Typography variant="body2" color="text.secondary">
                            Window: {e.window_starts_at} → {e.window_expires_at}
                          </Typography>
                        </Box>

                        <Box sx={{ display:'flex', gap:1 }}>
                          <StandardButton
                            size="small"
                            variant="contained"
                            onClick={() => respond(e.id, 'accepted')}
                            startIcon={<CheckCircle />}
                            color="success"
                          >
                            Accept
                          </StandardButton>
                          <StandardButton
                            size="small"
                            variant="outlined"
                            onClick={() => respond(e.id, 'declined')}
                            startIcon={<Cancel />}
                          >
                            Decline
                          </StandardButton>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ShiftQueue;
