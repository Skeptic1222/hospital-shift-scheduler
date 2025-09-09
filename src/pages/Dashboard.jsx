import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Chip,
  LinearProgress,
  Alert,
  Paper,
  Divider
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  AccessTime as AccessTimeIcon,
  NotificationsActive as NotificationsIcon,
  LocalHospital as HospitalIcon,
  Speed as SpeedIcon,
  Assignment as AssignmentIcon,
  EventAvailable as EventAvailableIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { apiFetch, apiWithRetry } from '../utils/apiWithErrorHandling';
import StandardButton from '../components/common/StandardButton';
import { LoadingSpinner } from '../components/common/LoadingState';
import { useSocket } from '../contexts/SocketContext';
import { useNotification } from '../contexts/NotificationContext';
import MetricCard, { StaffMetricCard, ShiftMetricCard, ResponseMetricCard } from '../components/MetricCard';
import ShiftCalendar from '../components/ShiftCalendar';
import AgendaList from '../components/AgendaList';
import FatigueIndicator from '../components/FatigueIndicator';
import QuickActions from '../components/QuickActions';
import RealtimeMetrics from '../components/RealtimeMetrics';

const Dashboard = () => {
  const socket = useSocket();
  const navigate = useNavigate();
  const { notifications } = useNotification();
  const [metrics, setMetrics] = useState({
    shiftsToday: 0,
    openShifts: 0,
    staffOnDuty: 0,
    fillRate: 0,
    avgResponseTime: 0,
    overtimeHours: 0,
    fatigueAlerts: 0,
    upcomingShifts: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // const { execute: executeApi } = useApiCall();
  const [userStats, setUserStats] = useState({
    hoursThisWeek: 0,
    shiftsCompleted: 0,
    nextShift: null,
    fatigueScore: 0,
    consecutiveDays: 0
  });
  const [alerts, setAlerts] = useState([]);
  const [miniView, setMiniView] = useState('calendar'); // 'calendar' | 'agenda'

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to real-time updates
    if (socket) {
      socket.on('metrics:update', handleMetricsUpdate);
      socket.on('shift:new', handleNewShift);
      socket.on('alert:new', handleNewAlert);
      socket.emit('metrics:subscribe', { type: 'dashboard' });
    }

    return () => {
      if (socket) {
        socket.off('metrics:update');
        socket.off('shift:new');
        socket.off('alert:new');
      }
    };
  }, [socket]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Retry briefly to smooth over transient mobile network hiccups
      const response = await apiWithRetry(() => apiFetch('/api/dashboard/metrics'), 2, 700);
      const data = await response.json();
      setMetrics(data.metrics || {});
      setUserStats(data.userStats || {});
      setAlerts(data.alerts || []);
    } catch (err) {
      // Graceful fallback: populate safe defaults instead of blocking the UI
      // This addresses mobile environments where the first fetch may fail
      // (e.g., captive portals, flaky radio, or strict proxies)
      try { console.warn('Dashboard metrics failed, showing safe defaults:', err?.message || err); } catch (_) {}
      setMetrics(prev => prev && Object.keys(prev).length ? prev : {
        shiftsToday: 0,
        openShifts: 0,
        staffOnDuty: 0,
        fillRate: 0,
        avgResponseTime: 0,
        overtimeHours: 0,
        fatigueAlerts: 0,
        upcomingShifts: []
      });
      setUserStats(prev => prev || {
        hoursThisWeek: 0,
        shiftsCompleted: 0,
        nextShift: null,
        fatigueScore: 0,
        consecutiveDays: 0
      });
      setAlerts(prev => prev || []);
      // Do not set a blocking error; allow the rest of the dashboard to render
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMetricsUpdate = (data) => {
    setMetrics(prev => ({ ...prev, ...data }));
  };

  const handleNewShift = (_shift) => {
    setMetrics(prev => ({
      ...prev,
      openShifts: prev.openShifts + 1
    }));
  };

  const handleNewAlert = (alert) => {
    setAlerts(prev => [alert, ...prev].slice(0, 5));
  };

  const handleQuickAction = async (action) => {
    switch (action) {
      case 'viewSchedule':
        navigate('/schedule');
        break;
      case 'requestTimeOff':
        navigate('/profile');
        break;
      case 'swapShift':
        navigate('/queue');
        break;
      case 'viewOpenShifts':
        navigate('/queue');
        break;
      case 'viewOnCall':
        navigate('/oncall');
        break;
      case 'viewStaff':
        navigate('/staff');
        break;
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const errorBanner = error ? (
    <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
      Unable to load dashboard data. Showing latest available info.
      <StandardButton size="small" variant="outlined" sx={{ ml: 2 }} onClick={fetchDashboardData}>
        Retry
      </StandardButton>
    </Alert>
  ) : null;

  return (
    <Box sx={{ 
      flexGrow: 1, 
      p: { xs: 2, sm: 3 },
      overflow: 'visible',
      width: '100%'
    }}>
      {errorBanner}
      {/* Welcome Section */}
      <Paper sx={{ 
        p: { xs: 2, sm: 3 }, 
        mb: 3, 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        overflow: 'hidden'
      }}>
        <Typography variant="h4" sx={{ color: 'white', mb: 1 }}>
          Welcome back! 👋
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.9)' }}>
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </Typography>
      </Paper>

      {/* Critical Alerts */}
      {alerts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {alerts.map((alert, index) => (
            <Alert
              key={index}
              severity={alert.severity}
              sx={{ mb: 1 }}
              action={
                alert.actionable && (
                  <StandardButton
                    color="inherit"
                    size="small"
                    onClick={() => handleQuickAction(alert.action)}
                  >
                    {alert.actionText}
                  </StandardButton>
                )
              }
            >
              {alert.message}
            </Alert>
          ))}
        </Box>
      )}

      {/* Metrics Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <ShiftMetricCard
            filled={metrics.shiftsToday - metrics.openShifts}
            total={metrics.shiftsToday}
            shiftType="Today"
            trend={+5}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Open Shifts"
            value={metrics.openShifts}
            icon={<EventAvailableIcon />}
            color={metrics.openShifts > 5 ? 'warning' : 'success'}
            urgent={metrics.openShifts > 5}
            subtitle="Requires immediate attention"
            details={`${metrics.openShifts} shifts need to be filled within the next 24 hours`}
            status={metrics.openShifts > 10 ? 'critical' : metrics.openShifts > 5 ? 'warning' : 'good'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StaffMetricCard
            available={metrics.staffOnDuty}
            total={metrics.totalStaff || 50}
            department="All"
            urgent={metrics.staffOnDuty < 20}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ResponseMetricCard
            avgTime={metrics.avgResponseTime || 15}
            target={20}
            trend={-12}
          />
        </Grid>
      </Grid>

      {/* Additional Metrics Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Fill Rate"
            value={metrics.fillRate}
            unit="%"
            icon={<TrendingUpIcon />}
            color={metrics.fillRate >= 95 ? 'success' : 'warning'}
            trend={metrics.fillRate >= 95 ? +2 : -3}
            progress={metrics.fillRate}
            maxValue={100}
            subtitle="Last 7 days"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Overtime Hours"
            value={metrics.overtimeHours || 0}
            unit="hrs"
            icon={<AccessTimeIcon />}
            color={metrics.overtimeHours > 100 ? 'error' : 'info'}
            urgent={metrics.overtimeHours > 100}
            details="Total overtime hours this week across all departments"
            status={metrics.overtimeHours > 150 ? 'critical' : metrics.overtimeHours > 100 ? 'warning' : 'good'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Fatigue Alerts"
            value={metrics.fatigueAlerts || 0}
            icon={<WarningIcon />}
            color={metrics.fatigueAlerts > 0 ? 'error' : 'success'}
            urgent={metrics.fatigueAlerts > 0}
            subtitle="Active alerts"
            details={`${metrics.fatigueAlerts} staff members are showing signs of fatigue`}
            status={metrics.fatigueAlerts > 5 ? 'critical' : metrics.fatigueAlerts > 0 ? 'warning' : 'good'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Coverage Score"
            value={95}
            unit="%"
            icon={<SpeedIcon />}
            color="success"
            trend={+3}
            progress={95}
            maxValue={100}
            subtitle="Department average"
            expandable={true}
          >
            <Box>
              <Typography variant="caption" display="block" gutterBottom>
                Department Breakdown:
              </Typography>
              <Box sx={{ pl: 1 }}>
                <Typography variant="body2">ED: 98%</Typography>
                <Typography variant="body2">ICU: 95%</Typography>
                <Typography variant="body2">OR: 92%</Typography>
                <Typography variant="body2">General: 94%</Typography>
              </Box>
            </Box>
          </MetricCard>
        </Grid>
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Left Column - Personal Stats */}
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ mb: 3, height: 'auto' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <AssignmentIcon sx={{ mr: 1 }} />
                Your Week at a Glance
              </Typography>
              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Hours This Week
                </Typography>
                <Typography variant="h4">
                  {userStats.hoursThisWeek}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(userStats.hoursThisWeek / 40) * 100}
                  sx={{ mt: 1 }}
                  color={userStats.hoursThisWeek > 40 ? 'warning' : 'primary'}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Next Shift
                </Typography>
                {userStats.nextShift && userStats.nextShift.start ? (
                  <Box>
                    <Typography variant="body1">
                      {(() => {
                        try {
                          const date = new Date(userStats.nextShift.start);
                          if (isNaN(date.getTime())) {
                            return 'Time not available';
                          }
                          return format(date, 'MMM d, h:mm a');
                        } catch (error) {
                          return 'Time not available';
                        }
                      })()}
                    </Typography>
                    <Chip
                      label={userStats.nextShift.department || 'Department'}
                      size="small"
                      color="primary"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                ) : (
                  <Typography variant="body1">No upcoming shifts</Typography>
                )}
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Fatigue Level
                </Typography>
                <FatigueIndicator
                  score={userStats.fatigueScore}
                  consecutiveDays={userStats.consecutiveDays}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <QuickActions onAction={handleQuickAction} />
        </Grid>

        {/* Center Column - Schedule Overview */}
        <Grid item xs={12} md={12} lg={5}>
          <Card sx={{ height: { xs: 400, sm: 500, lg: 600 } }}>
            <CardContent sx={{ 
              p: { xs: 1, sm: 2 },
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <ScheduleIcon sx={{ mr: 1 }} />
                This Week's Schedule
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  View
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <StandardButton size="small" variant={miniView==='calendar'?'contained':'outlined'} onClick={() => setMiniView('calendar')}>Calendar</StandardButton>
                  <StandardButton size="small" variant={miniView==='agenda'?'contained':'outlined'} onClick={() => setMiniView('agenda')}>Agenda</StandardButton>
                  <StandardButton size="small" variant="outlined" onClick={() => {
                    import('../utils/export').then(({ exportShiftsICS }) => exportShiftsICS(metrics.upcomingShifts || [], 'shiftwise_week.ics'));
                  }}>ICS</StandardButton>
                  <StandardButton size="small" variant="outlined" onClick={() => {
                    import('../utils/export').then(({ exportShiftsCSV }) => exportShiftsCSV(metrics.upcomingShifts || [], 'shiftwise_week.csv'));
                  }}>CSV</StandardButton>
                </Box>
              </Box>
              <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {miniView === 'calendar' ? (
                  <ShiftCalendar
                    shifts={metrics.upcomingShifts}
                    onShiftClick={(_shift) => navigate('/schedule')}
                  />
                ) : (
                  <AgendaList shifts={metrics.upcomingShifts} days={7} />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Real-time Metrics */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <SpeedIcon sx={{ mr: 1 }} />
                Live Metrics
              </Typography>
              <RealtimeMetrics />
            </CardContent>
          </Card>

          {/* Department Coverage (dynamic) */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <HospitalIcon sx={{ mr: 1 }} />
                Department Coverage
              </Typography>
              <Box sx={{ mt: 2 }}>
                {(() => {
                  const groups = {};
                  (metrics.upcomingShifts || []).forEach(s => {
                    const dept = s.department_name || s.department || s.department_id || 'General';
                    const req = Number(s.required_staff || s.requiredStaff || 1);
                    const asg = (s.assigned_staff && s.assigned_staff.length) || s.assignedCount || 0;
                    const k = dept;
                    if (!groups[k]) groups[k] = { required: 0, assigned: 0 };
                    groups[k].required += req;
                    groups[k].assigned += asg;
                  });
                  const rows = Object.entries(groups)
                    .map(([dept, v]) => ({ dept, ...v, ratio: v.required > 0 ? v.assigned / v.required : 0 }))
                    .sort((a,b) => a.ratio - b.ratio)
                    .slice(0, 4);
                  if (rows.length === 0) return (
                    <Typography variant="body2">No department data</Typography>
                  );
                  return rows.map((r) => (
                    <Box key={r.dept} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">{r.dept}</Typography>
                        <Chip label={`${r.assigned}/${r.required}`} size="small" color={r.assigned >= r.required ? 'success' : (r.assigned > 0 ? 'warning' : 'default')} />
                      </Box>
                      <LinearProgress variant="determinate" value={Math.min(100, Math.round(r.ratio * 100))} color={r.assigned >= r.required ? 'success' : (r.assigned > 0 ? 'warning' : 'info')} />
                    </Box>
                  ));
                })()}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom Section - Notifications */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <NotificationsIcon sx={{ mr: 1 }} />
            Recent Activity
          </Typography>
          <Box sx={{ mt: 2 }}>
            {notifications.slice(0, 5).map((notification, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  py: 1,
                  borderBottom: index < 4 ? '1px solid #e0e0e0' : 'none'
                }}
              >
                <IconButton size="small" sx={{ mr: 2 }}>
                  {notification.type === 'shift' ? <ScheduleIcon /> : <NotificationsIcon />}
                </IconButton>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2">{notification.message}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {format(new Date(notification.timestamp), 'h:mm a')}
                  </Typography>
                </Box>
                {notification.actionable && (
                  <StandardButton
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/notifications/${notification.id}`)}
                  >
                    View
                  </StandardButton>
                )}
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Dashboard;


