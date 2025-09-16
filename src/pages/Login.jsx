// ⚠️ CRITICAL WARNING: NEVER ADD DEMO MODE TO THIS APPLICATION
// The client has explicitly forbidden ANY form of demo, mock, or test mode.
// This application REQUIRES a live database connection to function.
// DO NOT add any demo mode, mock data, or bypass mechanisms.

import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import StandardButton from '../components/common/StandardButton';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

const Login = () => {
  const [googleReady, setGoogleReady] = useState(false);
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

  useEffect(() => {
    // If already signed in via Google, skip to dashboard
    const existing = localStorage.getItem('google_credential');
    if (existing) {
      (function(){ window.location.hash = '#/dashboard'; })();
      return;
    }

    // Load Google Identity Services script
    if (!clientId) return;
    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [clientId]);

  useEffect(() => {
    if (!googleReady || !clientId || !window.google) return;
    try {
      // Ensure no auto-select One Tap after logout
      if (window.google?.accounts?.id?.disableAutoSelect) {
        const loggedOut = localStorage.getItem('google_logged_out');
        if (loggedOut === '1') {
          window.google.accounts.id.disableAutoSelect();
          localStorage.removeItem('google_logged_out');
        }
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => {
          if (resp && resp.credential) {
            localStorage.setItem('google_credential', resp.credential); localStorage.setItem('token', resp.credential);
            // Navigate to dashboard and force a reload so the app picks up the token
            window.location.hash = '#/dashboard';
            window.location.reload();
          }
        },
        auto_select: false,
        context: 'signin',
        itp_support: true,
        ux_mode: 'popup'
      });
    } catch (e) { void e; }
  }, [googleReady, clientId]);

  const handleGoogleSignIn = () => {
    try {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect?.();
        window.google.accounts.id.prompt();
      }
    } catch (e) { void e; }
  };


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
      <Typography variant="h5" sx={{ mb: 1 }}>Welcome</Typography>
      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        Sign in to continue
      </Typography>
      <StandardButton 
        variant="contained" 
        color="primary"
        size="large"
        fullWidth
        onClick={handleGoogleSignIn} 
        disabled={!clientId}
      >
        Sign in with Google
      </StandardButton>
      {!clientId && (
        <Typography sx={{ mt: 2 }} color="warning.main">Set REACT_APP_GOOGLE_CLIENT_ID and rebuild</Typography>
      )}
    </Box>
  );
};

export default Login;
