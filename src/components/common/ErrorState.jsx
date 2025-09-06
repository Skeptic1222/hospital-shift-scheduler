import React from 'react';
import { Box, Typography, Button, Alert, AlertTitle } from '@mui/material';
import { Error as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';

// Reusable error state component
export const ErrorMessage = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  severity = 'error',
  action,
}) => (
  <Alert
    severity={severity}
    action={
      onRetry ? (
        <Button
          color="inherit"
          size="small"
          onClick={onRetry}
          startIcon={<RefreshIcon />}
        >
          Retry
        </Button>
      ) : action
    }
    sx={{
      borderRadius: 1,
      '& .MuiAlert-icon': {
        fontSize: 28,
      }
    }}
  >
    <AlertTitle>{title}</AlertTitle>
    {message}
  </Alert>
);

// Full page error state
export const ErrorPage = ({
  title = 'Error',
  message = 'Something went wrong',
  onRetry,
  onGoBack,
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
      p: 3,
      textAlign: 'center',
    }}
  >
    <ErrorIcon
      sx={{
        fontSize: 64,
        color: 'error.main',
        mb: 2,
      }}
    />
    <Typography variant="h5" gutterBottom>
      {title}
    </Typography>
    <Typography
      variant="body1"
      color="text.secondary"
      sx={{ mb: 3, maxWidth: 400 }}
    >
      {message}
    </Typography>
    <Box sx={{ display: 'flex', gap: 2 }}>
      {onGoBack && (
        <Button
          variant="outlined"
          onClick={onGoBack}
        >
          Go Back
        </Button>
      )}
      {onRetry && (
        <Button
          variant="contained"
          onClick={onRetry}
          startIcon={<RefreshIcon />}
        >
          Try Again
        </Button>
      )}
    </Box>
  </Box>
);

// Inline error for forms
export const FormError = ({ error }) => {
  if (!error) return null;

  return (
    <Typography
      variant="caption"
      color="error"
      sx={{
        display: 'block',
        mt: 0.5,
      }}
    >
      {error}
    </Typography>
  );
};

// Error boundary fallback
export const ErrorBoundaryFallback = ({ error, resetError }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      p: 3,
      backgroundColor: 'background.default',
    }}
  >
    <Box
      sx={{
        maxWidth: 500,
        width: '100%',
        textAlign: 'center',
      }}
    >
      <ErrorIcon
        sx={{
          fontSize: 80,
          color: 'error.main',
          mb: 3,
        }}
      />
      <Typography variant="h4" gutterBottom>
        Application Error
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 2 }}
      >
        An unexpected error occurred. The application encountered a problem and couldn't continue.
      </Typography>
      {process.env.NODE_ENV === 'development' && error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            textAlign: 'left',
            '& pre': {
              fontSize: '0.75rem',
              overflow: 'auto',
            }
          }}
        >
          <AlertTitle>Error Details (Development Only)</AlertTitle>
          <pre>{error.toString()}</pre>
        </Alert>
      )}
      <Button
        variant="contained"
        onClick={resetError}
        size="large"
        startIcon={<RefreshIcon />}
      >
        Reload Application
      </Button>
    </Box>
  </Box>
);

export default ErrorMessage;

