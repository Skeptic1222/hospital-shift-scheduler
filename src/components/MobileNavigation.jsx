import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  IconButton,
  Box,
  Divider,
  Typography,
  Avatar,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Schedule as ScheduleIcon,
  Queue as QueueIcon,
  Person as PersonIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  AdminPanelSettings as AdminIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  PhoneInTalk as OnCallIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';

const MobileNavigation = ({ user, onLogout, notificationCount = 0 }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Bottom navigation items (most used)
  const bottomNavItems = [
    { path: '/dashboard', label: 'Home', icon: <DashboardIcon /> },
    { path: '/schedule', label: 'Schedule', icon: <ScheduleIcon /> },
    { path: '/queue', label: 'Queue', icon: <QueueIcon /> },
    { path: '/profile', label: 'Profile', icon: <PersonIcon /> },
  ];

  // Drawer menu items (all options)
  const drawerItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { path: '/schedule', label: 'Schedule', icon: <ScheduleIcon /> },
    { path: '/queue', label: 'Shift Queue', icon: <QueueIcon /> },
    { path: '/staff', label: 'Staff', icon: <PeopleIcon /> },
    { path: '/oncall', label: 'On Call', icon: <OnCallIcon /> },
    { path: '/notifications', label: 'Notifications', icon: <NotificationsIcon />, badge: notificationCount },
    { path: '/profile', label: 'Profile', icon: <PersonIcon /> },
    { path: '/settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  // Add admin item if user is admin
  if (user?.role === 'admin' || user?.serverAdmin) {
    drawerItems.push({ path: '/admin', label: 'Admin', icon: <AdminIcon /> });
  }

  const handleNavigate = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const getCurrentPath = () => {
    const path = location.pathname;
    // Match the most specific path
    for (const item of bottomNavItems) {
      if (path.startsWith(item.path)) {
        return item.path;
      }
    }
    return '/dashboard';
  };

  if (!isMobile) {
    return null; // Desktop navigation is handled by Layout
  }

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: theme.zIndex.appBar,
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
        elevation={3}
      >
        <BottomNavigation
          value={getCurrentPath()}
          onChange={(event, newValue) => handleNavigate(newValue)}
          showLabels
          sx={{
            height: 56,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              padding: '6px 0',
              color: theme.palette.text.secondary,
              '&.Mui-selected': {
                color: theme.palette.primary.main,
              },
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.75rem',
              '&.Mui-selected': {
                fontSize: '0.75rem',
              },
            },
          }}
        >
          {bottomNavItems.map((item) => (
            <BottomNavigationAction
              key={item.path}
              value={item.path}
              label={item.label}
              icon={
                item.path === '/notifications' && notificationCount > 0 ? (
                  <Badge badgeContent={notificationCount} color="error">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )
              }
            />
          ))}
          <BottomNavigationAction
            label="More"
            icon={<MenuIcon />}
            onClick={(e) => {
              e.preventDefault();
              setDrawerOpen(true);
            }}
          />
        </BottomNavigation>
      </Paper>

      {/* Mobile Drawer Menu */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: '80%',
            maxWidth: 300,
          },
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Drawer Header */}
          <Box
            sx={{
              p: 2,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'white',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <IconButton
                edge="start"
                color="inherit"
                onClick={() => setDrawerOpen(false)}
                sx={{ mr: 1 }}
              >
                <CloseIcon />
              </IconButton>
              <Typography variant="h6" sx={{ flex: 1 }}>
                Menu
              </Typography>
            </Box>

            {/* User Info */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar
                src={user?.picture}
                sx={{ width: 48, height: 48, mr: 2, bgcolor: 'white', color: theme.palette.primary.main }}
              >
                {user?.name?.[0] || user?.email?.[0] || 'U'}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" noWrap>
                  {user?.name || 'User'}
                </Typography>
                <Typography variant="caption" noWrap sx={{ opacity: 0.9 }}>
                  {user?.email}
                </Typography>
                {user?.role && (
                  <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
                    Role: {user.role}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>

          {/* Navigation Items */}
          <List sx={{ flex: 1, pt: 1 }}>
            {drawerItems.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  selected={location.pathname.startsWith(item.path)}
                  onClick={() => handleNavigate(item.path)}
                  sx={{
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.action.selected,
                      borderLeft: `3px solid ${theme.palette.primary.main}`,
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {item.badge ? (
                      <Badge badgeContent={item.badge} color="error">
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    )}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          <Divider />

          {/* Logout Button */}
          <List>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  setDrawerOpen(false);
                  onLogout && onLogout();
                }}
                sx={{
                  color: theme.palette.error.main,
                  '&:hover': {
                    backgroundColor: theme.palette.error.light + '20',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* Spacer to prevent content from being hidden behind bottom nav */}
      <Box sx={{ height: 56 }} />
    </>
  );
};

export default MobileNavigation;
