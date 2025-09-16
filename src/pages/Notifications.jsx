import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  IconButton,
  Chip,
  Tabs,
  Tab,
  Badge,
  Paper,
  Divider,
  Menu,
  MenuItem,
  Alert,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  Schedule as ShiftIcon,
  SwapHoriz as SwapIcon,
  Warning as AlertIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  DoneAll as MarkAllReadIcon,
  LocalHospital as UrgentIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import StandardButton from '../components/common/StandardButton';
import { CardSkeleton } from '../components/common/LoadingState';
import { ErrorMessage } from '../components/common/ErrorState';
import { formatDistanceToNow } from 'date-fns';

const NOTIFICATION_TYPES = {
  shift: { icon: ShiftIcon, color: '#3b82f6' },
  swap: { icon: SwapIcon, color: '#10b981' },
  alert: { icon: AlertIcon, color: '#f59e0b' },
  info: { icon: InfoIcon, color: '#6b7280' },
  success: { icon: SuccessIcon, color: '#10b981' },
  error: { icon: ErrorIcon, color: '#ef4444' },
  urgent: { icon: UrgentIcon, color: '#ef4444' }
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('all');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    loadNotifications();
    // Set up polling for new notifications
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadNotifications() {
    try {
      setError(null);
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/notifications');
      const data = await res.json();

      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (err) {
      setError('Failed to load notifications');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(ids) {
    try {
      const { apiFetch } = await import('../utils/api');
      await apiFetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.isArray(ids) ? ids : [ids] })
      });

      setNotifications(prev => prev.map(n =>
        (Array.isArray(ids) ? ids : [ids]).includes(n.id)
          ? { ...n, read: true }
          : n
      ));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }

  async function deleteNotifications(ids) {
    try {
      const { apiFetch } = await import('../utils/api');
      await apiFetch('/api/notifications/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.isArray(ids) ? ids : [ids] })
      });

      setNotifications(prev => prev.filter(n =>
        !(Array.isArray(ids) ? ids : [ids]).includes(n.id)
      ));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  const handleMenuOpen = (event, notification) => {
    setAnchorEl(event.currentTarget);
    setSelectedNotification(notification);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedNotification(null);
  };

  const handleSelectToggle = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'unread') return !n.read;
    if (selectedTab === 'urgent') return n.priority === 'urgent' || n.priority === 'high';
    return n.type === selectedTab;
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const urgentCount = notifications.filter(n => n.priority === 'urgent' && !n.read).length;

  if (loading) {
    return <CardSkeleton count={3} />;
  }

  if (error && notifications.length === 0) {
    return (
      <ErrorMessage
        title="Unable to load notifications"
        message={error}
        onRetry={loadNotifications}
      />
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5">Notifications</Typography>
          {unreadCount > 0 && (
            <Chip
              label={`${unreadCount} unread`}
              color="primary"
              size="small"
            />
          )}
          {urgentCount > 0 && (
            <Chip
              label={`${urgentCount} urgent`}
              color="error"
              size="small"
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {selectedIds.size > 0 && (
            <>
              <StandardButton
                variant="outlined"
                size="small"
                onClick={() => markAsRead(Array.from(selectedIds))}
                startIcon={<MarkAllReadIcon />}
              >
                Mark Read ({selectedIds.size})
              </StandardButton>
              <StandardButton
                variant="outlined"
                size="small"
                color="error"
                onClick={() => deleteNotifications(Array.from(selectedIds))}
                startIcon={<DeleteIcon />}
              >
                Delete ({selectedIds.size})
              </StandardButton>
            </>
          )}
          <StandardButton
            variant="outlined"
            size="small"
            onClick={loadNotifications}
          >
            Refresh
          </StandardButton>
        </Box>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={selectedTab}
          onChange={(e, val) => setSelectedTab(val)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            label="All"
            value="all"
            icon={<Badge badgeContent={notifications.length} color="default" />}
          />
          <Tab
            label="Unread"
            value="unread"
            icon={<Badge badgeContent={unreadCount} color="primary" />}
          />
          <Tab
            label="Urgent"
            value="urgent"
            icon={<Badge badgeContent={urgentCount} color="error" />}
          />
          <Tab label="Shifts" value="shift" />
          <Tab label="Swaps" value="swap" />
          <Tab label="Alerts" value="alert" />
        </Tabs>
      </Paper>

      {selectedIds.size > 0 && (
        <Paper sx={{ p: 1, mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedIds.size === filteredNotifications.length}
                indeterminate={selectedIds.size > 0 && selectedIds.size < filteredNotifications.length}
                onChange={handleSelectAll}
              />
            }
            label={`${selectedIds.size} selected`}
          />
        </Paper>
      )}

      {filteredNotifications.length === 0 ? (
        <Alert severity="info">
          No {selectedTab === 'all' ? '' : selectedTab} notifications
        </Alert>
      ) : (
        <List>
          {filteredNotifications.map((notification, index) => {
            const TypeIcon = NOTIFICATION_TYPES[notification.type]?.icon || InfoIcon;
            const typeColor = NOTIFICATION_TYPES[notification.type]?.color || '#6b7280';

            return (
              <React.Fragment key={notification.id}>
                <ListItem
                  sx={{
                    opacity: notification.read ? 0.7 : 1,
                    backgroundColor: notification.read ? 'transparent' : 'action.hover',
                    borderLeft: notification.priority === 'urgent' ? '4px solid' : 'none',
                    borderLeftColor: 'error.main',
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <Checkbox
                    checked={selectedIds.has(notification.id)}
                    onChange={() => handleSelectToggle(notification.id)}
                    sx={{ mr: 1 }}
                  />

                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: typeColor }}>
                      <TypeIcon />
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: notification.read ? 400 : 600 }}>
                          {notification.title}
                        </Typography>
                        {notification.priority === 'urgent' && (
                          <Chip label="URGENT" color="error" size="small" />
                        )}
                        {notification.priority === 'high' && (
                          <Chip label="High" color="warning" size="small" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {notification.message}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <TimeIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.disabled">
                            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                          </Typography>
                          {notification.metadata?.department && (
                            <>
                              <Divider orientation="vertical" flexItem />
                              <Chip label={notification.metadata.department} size="small" variant="outlined" />
                            </>
                          )}
                        </Box>
                      </Box>
                    }
                  />

                  <ListItemSecondaryAction>
                    {notification.actionable && (
                      <StandardButton
                        size="small"
                        variant="contained"
                        sx={{ mr: 1 }}
                        onClick={() => {
                          // Handle action based on type
                          if (process.env.NODE_ENV !== 'production') {
                            // eslint-disable-next-line no-console
                            console.log('Action:', notification.action, notification.metadata);
                          }
                        }}
                      >
                        {notification.action === 'viewShift' && 'View'}
                        {notification.action === 'viewSwap' && 'Review'}
                        {notification.action === 'respondUrgent' && 'Respond'}
                      </StandardButton>
                    )}

                    <IconButton onClick={(e) => handleMenuOpen(e, notification)}>
                      <MoreIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < filteredNotifications.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </List>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedNotification && !selectedNotification.read && (
          <MenuItem onClick={() => {
            markAsRead(selectedNotification.id);
            handleMenuClose();
          }}>
            Mark as Read
          </MenuItem>
        )}
        <MenuItem onClick={() => {
          if (selectedNotification) {
            deleteNotifications(selectedNotification.id);
          }
          handleMenuClose();
        }}>
          Delete
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          Mute Similar
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Notifications;
