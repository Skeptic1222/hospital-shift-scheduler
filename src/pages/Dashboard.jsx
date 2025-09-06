import React, { useState, useEffect } from 'react';
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
  Button,
  Tooltip,
  Paper,
  Divider
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
  NotificationsActive as NotificationsIcon,
  LocalHospital as HospitalIcon,
  Speed as SpeedIcon,
  Assignment as AssignmentIcon,
  SwapHoriz as SwapIcon,
  EventAvailable as EventAvailableIcon
} from '@mui/icons-material';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { apiFetch, useApiCall } from '../utils/apiWithErrorHandling';
import StandardButton from '../components/common/StandardButton';
import { LoadingSpinner } from '../components/common/LoadingState';
import { ErrorMessage } from '../components/common/ErrorState';
import { useSocket } from '../contexts/SocketContext';
import { useNotification } from '../contexts/NotificationContext';
import MetricCard, { StaffMetricCard, ShiftMetricCard, ResponseMetricCard } from '../components/MetricCard';
import ShiftCalendar from '../components/ShiftCalendar';
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
  const { execute: executeApi } = useApiCall();
  const [userStats, setUserStats] = useState({
    hoursThisWeek: 0,
    shiftsCompleted: 0,
    nextShift: null,
    fatigueScore: 0,
    consecutiveDays: 0
  });
  const [alerts, setAlerts] = useState([]);

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
      const response = await apiFetch('/api/dashboard/metrics');
      const data = await response.json();
      setMetrics(data.metrics || {});
      setUserStats(data.userStats || {});
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleMetricsUpdate = (data) => {
    setMetrics(prev => ({ ...prev, ...data }));
  };

  const handleNewShift = (shift) => {
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

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <ErrorMessage
          title="Unable to load dashboard"
          message={error}
          onRetry={fetchDashboardData}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      flexGrow: 1, 
      p: { xs: 2, sm: 3 },
      overflow: 'visible',
      width: '100%'
    }}>
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
              <Box sx={{ 
                flex: 1,
                minHeight: 0,
                overflow: 'hidden'
              }}>
                <ShiftCalendar
                  shifts={metrics.upcomingShifts}
                  onShiftClick={(shift) => console.log('Shift clicked:', shift)}
                />
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

          {/* Department Status */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <HospitalIcon sx={{ mr: 1 }} />
                Department Status
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Emergency</Typography>
                    <Chip label="Fully Staffed" size="small" color="success" />
                  </Box>
                  <LinearProgress variant="determinate" value={100} color="success" />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">ICU</Typography>
                    <Chip label="2 Open" size="small" color="warning" />
                  </Box>
                  <LinearProgress variant="determinate" value={75} color="warning" />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Surgery</Typography>
                    <Chip label="Fully Staffed" size="small" color="success" />
                  </Box>
                  <LinearProgress variant="determinate" value={100} color="success" />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Pediatrics</Typography>
                    <Chip label="1 Open" size="small" color="info" />
                  </Box>
                  <LinearProgress variant="determinate" value={90} color="info" />
                </Box>
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











