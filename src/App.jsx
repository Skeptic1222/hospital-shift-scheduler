// Build timestamp: 2025-09-06 10:45 - UI fixes applied with cache bust
import { useEffect, useState } from 'react';
import { BrowserRouter as BrowserRouter, HashRouter as HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { responsiveFontSizes } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Provider } from 'react-redux';
import { store } from './store';
// Auth0 removed: Google OAuth only
import io from 'socket.io-client';

// Components
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import ShiftQueue from './pages/ShiftQueue';
import Notifications from './pages/Notifications';
import OnCall from './pages/OnCall';
import Staff from './pages/Staff';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import Login from './pages/Login';
// import LoadingScreen from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';

// Contexts
import { SocketProvider } from './contexts/SocketContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Service Worker for PWA
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// Theme configuration
let theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      light: '#60a5fa',
      dark: '#1e40af',
    },
    secondary: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
    },
    error: {
      main: '#ef4444',
    },
    warning: {
      main: '#f59e0b',
    },
    info: {
      main: '#3b82f6',
    },
    success: {
      main: '#10b981',
    },
    background: {
      default: '#f9fafb',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 44,
          minWidth: 88,
          paddingLeft: 12,
          paddingRight: 12,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        },
      },
    },
  },
});
theme = responsiveFontSizes(theme, { factor: 2 });

function App() {
  // Google-only auth
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('google_credential'));
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const handleLogout = () => {
    localStorage.removeItem('google_credential');
    localStorage.setItem('google_logged_out','1');
    window.location.pathname = (process.env.PUBLIC_URL || '/scheduler') + '/';
    window.location.reload();
  };
  useEffect(() => {
    const token = localStorage.getItem('google_credential');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        (function(){
          const envAdmins=(process.env.REACT_APP_ADMIN_EMAILS||'').split(',').map(s=>s.trim()).filter(Boolean);
          const envSups=(process.env.REACT_APP_SUPERVISOR_EMAILS||'').split(',').map(s=>s.trim()).filter(Boolean);
          let localAdmins=[]; let localSups=[];
          try { localAdmins=(localStorage.getItem('admin_emails')||'').split(',').map(s=>s.trim()).filter(Boolean); } catch(e){ void e; }
          try { localSups=(localStorage.getItem('supervisor_emails')||'').split(',').map(s=>s.trim()).filter(Boolean); } catch(e){ void e; }
          const admins=[...new Set([...envAdmins, ...localAdmins, 'sop1973@gmail.com'])];
          const sups=[...new Set([...envSups, ...localSups])];
          let role='user';
          if (admins.includes(payload.email)) role='admin'; else if (sups.includes(payload.email)) role='supervisor';
          setUser({ sub: payload.sub, name: payload.name, email: payload.email, picture: payload.picture, role });
        })();
        setIsAuthenticated(true);
      } catch (_) {
        setUser(null);
        setIsAuthenticated(false);
      }
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);


  // Initialize Socket.io connection
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let createdSocket = null; // track socket created in this effect
    if (isAuthenticated) {
      const initSocket = async () => {
        try {
          const token = localStorage.getItem('google_credential') || '';
          // Absolute public base preferred (same as API base). Example:
          // REACT_APP_PUBLIC_BASE=http://localhost/scheduler or http://PUBLIC_IP/scheduler
          const publicBase = process.env.REACT_APP_PUBLIC_BASE || (typeof window !== 'undefined' && window.__PUBLIC_BASE__);
          let socketUrl = '';
          let socketPath = '/scheduler/socket.io';
          if (publicBase) {
            try {
              const u = new URL(publicBase);
              socketUrl = `${u.protocol}//${u.host}`;
              // Ensure scheduler prefix
              socketPath = `${u.pathname.replace(/\/$/, '')}/socket.io`;
            } catch (_) {
              // Fallback to same-origin
              socketUrl = '';
              socketPath = '/scheduler/socket.io';
            }
          } else {
            // Same-origin fallback
            socketUrl = '';
            socketPath = '/scheduler/socket.io';
          }

          const transportPref = (localStorage.getItem('socket_transport') || 'polling');
          const useWebsocket = transportPref === 'websocket';
          const newSocket = io(socketUrl, {
            auth: { token },
            path: socketPath,
            transports: useWebsocket ? ['websocket', 'polling'] : ['polling'],
            upgrade: useWebsocket,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
          });

          newSocket.on('connect', () => {
            // Connected to server
          });

          newSocket.on('disconnect', (_reason) => {
            // Disconnected from server
          });

          newSocket.on('error', (error) => {
            console.error('Socket error:', error);
          });

          // Track this specific socket for cleanup
          createdSocket = newSocket;
          setSocket(newSocket);
        } catch (error) {
          console.error('Socket initialization error:', error);
        }
      };

      initSocket();
    }

    // Cleanup only the socket created in this effect run
    return () => {
      try { createdSocket && createdSocket.disconnect(); } catch (_) { /* ignore */ void 0; }
    };
  }, [isAuthenticated]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Register service worker for PWA
  useEffect(() => {
    serviceWorkerRegistration.register({
      onUpdate: (registration) => {
        const waitingServiceWorker = registration.waiting;
        if (waitingServiceWorker) {
          waitingServiceWorker.addEventListener('statechange', (event) => {
            if (event.target.state === 'activated') {
              window.location.reload();
            }
          });
          waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      },
    });
  }, []);

  // No loading gate for Google-only auth

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login />
      </ThemeProvider>
    );
  }

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <SocketProvider socket={socket}>
            <NotificationProvider>
              <ErrorBoundary>
                {(() => {
                  const useHash = typeof window !== 'undefined' && window.__USE_HASH_ROUTER__ === true;
                  const Router = useHash ? HashRouter : BrowserRouter;
                  const props = useHash ? {} : { basename: process.env.PUBLIC_URL || '/scheduler' };
                  return (
                    <Router {...props}>
                      <Layout user={user} onLogout={handleLogout}>
                        {!isOnline && <OfflineIndicator />}
                        <Routes>
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/schedule" element={<Schedule />} />
                          <Route path="/queue" element={<ShiftQueue />} />
                          <Route path="/staff" element={<Staff />} />
                          <Route path="/oncall" element={<OnCall />} />
                          <Route path="/notifications" element={<Notifications />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/admin/*" element={
                            (user?.role === 'admin') ? <Admin /> : <Navigate to="/dashboard" />
                          } />
                          <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                      </Layout>
                    </Router>
                  );
                })()}
              </ErrorBoundary>
            </NotificationProvider>
          </SocketProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App;

