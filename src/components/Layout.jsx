// ⚠️ CRITICAL WARNING: NEVER ADD DEMO MODE TO THIS APPLICATION
// The client has explicitly forbidden ANY form of demo, mock, or test mode.
// This application REQUIRES a live database connection to function.
// DO NOT add any demo mode, mock data, or bypass mechanisms.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Badge,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Schedule as ScheduleIcon,
  Queue as QueueIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import MobileNavigation from './MobileNavigation';
import StandardButton from './common/StandardButton';
import ToastStack from './ToastStack';
import { apiFetch } from '../utils/api';

const Layout = ({ children, user, onLogout }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const open = Boolean(anchorEl);
  const isGoogle = typeof window !== 'undefined' && !!localStorage.getItem('google_credential');
  const [serverAdmin, setServerAdmin] = useState(false);

  const { initials, name, email, picture } = useMemo(() => {
    const name = user?.name || '';
    const email = user?.email || '';
    const picture = user?.picture || '';
    const initials = (name || email || 'U')
      .split(/\s+/)
      .filter(Boolean)
      .map(p => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return { initials, name, email, picture };
  }, [user]);

  const handleMenu = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const go = (path) => { navigate(path); handleClose(); };

  // Probe server admin capability to show Admin menu even if token lacks roles
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/admin/status');
        if (res.ok) setServerAdmin(true);
      } catch (_) { /* ignore */ }
    })();
  }, []);


  return (
    <>
      <AppBar position="sticky" color="primary" elevation={1}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          <Typography
            variant={isMobile ? 'h6' : 'h5'}
            component="div"
            sx={{
              flexGrow: 1,
              cursor: 'pointer',
              fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
            onClick={() => navigate('/dashboard')}
          >
            {isMobile ? 'SW' : 'Shiftwise'}
            {user?.role === 'admin' && (
              <Box
                component="span"
                sx={{
                  backgroundColor: '#fbbf24',
                  color: '#000',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'inline-block'
                }}
              >
                ADMIN
              </Box>
            )}
          </Typography>

          {/* Desktop Navigation Buttons */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
              <StandardButton
                color="inherit"
                variant="text"
                startIcon={<DashboardIcon />}
                onClick={() => navigate('/dashboard')}
                sx={{ display: isTablet ? 'none' : 'flex', fontSize: '0.9rem' }}
              >
                Dashboard
              </StandardButton>
              <StandardButton
                color="inherit"
                variant="text"
                startIcon={<ScheduleIcon />}
                onClick={() => navigate('/schedule')}
                sx={{ fontSize: '0.9rem' }}
              >
                Schedule
              </StandardButton>
              <StandardButton
                color="inherit"
                variant="text"
                startIcon={<QueueIcon />}
                onClick={() => navigate('/queue')}
                sx={{ fontSize: '0.9rem' }}
              >
                Queue
              </StandardButton>
              <StandardButton
                color="inherit"
                variant="text"
                startIcon={<PeopleIcon />}
                onClick={() => navigate('/staff')}
                sx={{ display: isTablet ? 'none' : 'flex', fontSize: '0.9rem' }}
              >
                Staff
              </StandardButton>
            </Box>
          )}
          <Tooltip title={name || email || 'Account'}>
            <IconButton size="small" onClick={handleMenu} sx={{ ml: 1 }} aria-controls={open ? 'user-menu' : undefined} aria-haspopup="true" aria-expanded={open ? 'true' : undefined}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={isGoogle ? (
                  <Box sx={{ bgcolor: '#fff', borderRadius: '50%', p: '1px', border: '1px solid #e0e0e0' }}>
                    <Box component="span" sx={{ display: 'inline-block', width: 14, height: 14, fontSize: 10, fontWeight: 700, lineHeight: '14px', textAlign: 'center', color: '#4285F4' }}>G</Box>
                  </Box>
                ) : null}
              >
                <Avatar alt={name} src={picture || undefined} sx={{ width: 34, height: 34 }}>
                  {initials}
                </Avatar>
              </Badge>
            </IconButton>
          </Tooltip>
          <Menu id="user-menu" anchorEl={anchorEl} open={open} onClose={handleClose} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
            <MenuItem disabled>{name || email || 'User'}</MenuItem>
            {(user?.role === 'admin' || serverAdmin) && (
              <MenuItem onClick={() => go('/admin')}>Admin</MenuItem>
            )}
            <MenuItem onClick={() => go('/profile')}>Profile</MenuItem>
            <MenuItem onClick={() => go('/notifications')}>Notifications</MenuItem>
            <MenuItem onClick={() => go('/settings')}>Settings</MenuItem>
            <MenuItem onClick={() => { handleClose(); onLogout && onLogout(); }}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Main Content Container */}
      <Container
        maxWidth="lg"
        sx={{
          mt: { xs: 2, sm: 3 },
          mb: { xs: 8, sm: 3 }, // Extra margin bottom for mobile navigation
          px: { xs: 1, sm: 2, md: 3 },
          // Prevent content from being cut off
          overflow: 'visible',
          '& > *': {
            overflow: 'visible'
          }
        }}
      >
        <Box sx={{
          width: '100%',
          minHeight: 'calc(100vh - 200px)',
          pb: { xs: 8, sm: 3 } // Padding bottom for mobile nav
        }}>
          {children}
        </Box>
      </Container>

      {/* Mobile Navigation */}
      {isMobile && (
        <MobileNavigation
          user={{ ...user, serverAdmin }}
          onLogout={onLogout}
          notificationCount={0}
        />
      )}

      {/* Global Toasts */}
      <ToastStack />
    </>
  );
};

export default Layout;
