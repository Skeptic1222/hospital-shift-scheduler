/**
 * Audit Log Viewer
 * HIPAA-compliant audit log viewing for administrators
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  Chip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  FilterList,
  Download,
  Refresh,
  Visibility,
  Warning,
  Security,
  PersonOutline,
  EventNote
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subDays } from 'date-fns';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: subDays(new Date(), 7),
    endDate: new Date(),
    eventType: '',
    userId: '',
    entityType: '',
    phiAccessed: '',
    flagged: ''
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [stats, setStats] = useState(null);

  // Event type options
  const eventTypes = [
    { value: '', label: 'All Events' },
    { value: 'AUTH_LOGIN', label: 'Login' },
    { value: 'AUTH_LOGOUT', label: 'Logout' },
    { value: 'AUTH_LOGIN_FAILED', label: 'Failed Login' },
    { value: 'PHI_VIEW', label: 'PHI View' },
    { value: 'PHI_UPDATE', label: 'PHI Update' },
    { value: 'PHI_DELETE', label: 'PHI Delete' },
    { value: 'PHI_EXPORT', label: 'PHI Export' },
    { value: 'ADMIN_USER_CREATE', label: 'User Created' },
    { value: 'ADMIN_ROLE_CHANGE', label: 'Role Changed' },
    { value: 'BREAK_GLASS_ACCESS', label: 'Emergency Access' }
  ];

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [filters, page, rowsPerPage]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...filters,
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString(),
        offset: page * rowsPerPage,
        limit: rowsPerPage
      });

      const response = await fetch(`/api/audit/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setTotalCount(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString()
      });

      const response = await fetch(`/api/audit/stats?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch audit stats:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...filters,
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString(),
        format: 'csv'
      });

      const response = await fetch(`/api/audit/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    }
  };

  const getRiskChip = (riskScore) => {
    if (riskScore >= 8) {
      return <Chip label="High Risk" color="error" size="small" icon={<Warning />} />;
    } else if (riskScore >= 5) {
      return <Chip label="Medium Risk" color="warning" size="small" />;
    } else {
      return <Chip label="Low Risk" color="success" size="small" />;
    }
  };

  const getEventTypeChip = (eventType) => {
    const colors = {
      'AUTH_': 'primary',
      'PHI_': 'warning',
      'ADMIN_': 'secondary',
      'BREAK_GLASS_': 'error',
      'SYSTEM_': 'default'
    };

    const prefix = Object.keys(colors).find(p => eventType.startsWith(p));
    const color = colors[prefix] || 'default';

    return <Chip label={eventType.replace(/_/g, ' ')} color={color} size="small" />;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          <Security sx={{ mr: 1, verticalAlign: 'middle' }} />
          Audit Logs
        </Typography>

        {/* Statistics */}
        {stats && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  Total Events
                </Typography>
                <Typography variant="h4">{stats.total_events}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  PHI Access
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats.phi_access_count}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  Failed Logins
                </Typography>
                <Typography variant="h4" color="error">
                  {stats.failed_logins?.length || 0}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  High Risk Events
                </Typography>
                <Typography variant="h4" color="error">
                  {stats.high_risk_events?.length || 0}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <DatePicker
                label="Start Date"
                value={filters.startDate}
                onChange={(date) => handleFilterChange('startDate', date)}
                renderInput={(params) => <TextField {...params} fullWidth size="small" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <DatePicker
                label="End Date"
                value={filters.endDate}
                onChange={(date) => handleFilterChange('endDate', date)}
                renderInput={(params) => <TextField {...params} fullWidth size="small" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Event Type</InputLabel>
                <Select
                  value={filters.eventType}
                  onChange={(e) => handleFilterChange('eventType', e.target.value)}
                  label="Event Type"
                >
                  {eventTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="User ID/Email"
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>PHI Access</InputLabel>
                <Select
                  value={filters.phiAccessed}
                  onChange={(e) => handleFilterChange('phiAccessed', e.target.value)}
                  label="PHI Access"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Yes</MenuItem>
                  <MenuItem value="false">No</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={fetchLogs}
                  fullWidth
                >
                  Refresh
                </Button>
                <Tooltip title="Export to CSV">
                  <IconButton onClick={handleExport} color="primary">
                    <Download />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Logs Table */}
        <TableContainer component={Paper}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Event Type</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>IP Address</TableCell>
                    <TableCell>Entity</TableCell>
                    <TableCell>PHI</TableCell>
                    <TableCell>Risk</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow 
                      key={log.id}
                      sx={{ 
                        backgroundColor: log.flagged ? 'error.light' : 'inherit',
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}
                    >
                      <TableCell>
                        {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                      </TableCell>
                      <TableCell>{getEventTypeChip(log.event_type)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <PersonOutline sx={{ mr: 1, fontSize: 16 }} />
                          {log.user_email || log.user_id}
                        </Box>
                      </TableCell>
                      <TableCell>{log.ip_address}</TableCell>
                      <TableCell>
                        {log.entity_type && (
                          <Chip 
                            label={`${log.entity_type}: ${log.entity_id}`} 
                            size="small" 
                            variant="outlined" 
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {log.phi_accessed && (
                          <Chip label="PHI" color="warning" size="small" icon={<Warning />} />
                        )}
                      </TableCell>
                      <TableCell>{getRiskChip(log.risk_score)}</TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedLog(log);
                              setDetailsOpen(true);
                            }}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={totalCount}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </>
          )}
        </TableContainer>

        {/* Details Dialog */}
        <Dialog
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Audit Log Details
            {selectedLog?.flagged && (
              <Chip label="FLAGGED" color="error" sx={{ ml: 2 }} />
            )}
          </DialogTitle>
          <DialogContent dividers>
            {selectedLog && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Log ID
                  </Typography>
                  <Typography>{selectedLog.id}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Timestamp
                  </Typography>
                  <Typography>
                    {format(new Date(selectedLog.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Event Type
                  </Typography>
                  <Typography>{selectedLog.event_type}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    User
                  </Typography>
                  <Typography>{selectedLog.user_email || selectedLog.user_id}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    IP Address
                  </Typography>
                  <Typography>{selectedLog.ip_address}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    User Agent
                  </Typography>
                  <Typography sx={{ fontSize: '0.875rem' }}>
                    {selectedLog.user_agent}
                  </Typography>
                </Grid>
                {selectedLog.entity_type && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Entity Type
                      </Typography>
                      <Typography>{selectedLog.entity_type}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Entity ID
                      </Typography>
                      <Typography>{selectedLog.entity_id}</Typography>
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Result
                  </Typography>
                  <Chip 
                    label={selectedLog.result} 
                    color={selectedLog.result === 'success' ? 'success' : 'error'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Risk Score
                  </Typography>
                  <Typography>{selectedLog.risk_score}/10</Typography>
                </Grid>
                {selectedLog.decrypted_data && (
                  <Grid item xs={12}>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      This log contains encrypted PHI data
                    </Alert>
                    <Typography variant="subtitle2" color="textSecondary">
                      Decrypted Data
                    </Typography>
                    <Paper sx={{ p: 2, backgroundColor: 'grey.100' }}>
                      <pre style={{ overflow: 'auto' }}>
                        {JSON.stringify(selectedLog.decrypted_data, null, 2)}
                      </pre>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default AuditLogs;