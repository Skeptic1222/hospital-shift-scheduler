import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Container,
  Alert,
  AlertTitle,
  Collapse,
  IconButton
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  BugReport as BugIcon,
  Home as HomeIcon
} from '@mui/icons-material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', error, errorInfo);
    }

    // Update state with error details
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Log to error reporting service (e.g., Sentry, LogRocket)
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService(error, errorInfo) {
    // Implement error logging to external service
    // Example: Sentry.captureException(error, { extra: errorInfo });
    
    // For now, just log to localStorage for debugging
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    try {
      const existingLogs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
      existingLogs.push(errorLog);
      // Keep only last 10 errors
      if (existingLogs.length > 10) {
        existingLogs.shift();
      }
      localStorage.setItem('errorLogs', JSON.stringify(existingLogs));
    } catch (e) {
      console.error('Failed to log error to localStorage:', e);
    }
  };

  handleReset() {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });

    // Optionally reload the page
    if (this.props.autoReload) {
      window.location.reload();
    }
  };

  handleGoHome() {
    window.location.href = '/';
  };

  toggleDetails() {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails, errorCount } = this.state;
      const { 
        title = 'Oops! Something went wrong', 
        message = 'We encountered an unexpected error. Please try refreshing the page.',
        showHomeButton = true,
        showReportButton = true,
        compact = false,
        customFallback
      } = this.props;

      // Use custom fallback if provided
      if (customFallback) {
        return customFallback(error, errorInfo, this.handleReset);
      }

      // Compact error display for smaller components
      if (compact) {
        return (
          <Alert 
            severity="error" 
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={this.handleReset}
                startIcon={<RefreshIcon />}
              >
                Retry
              </Button>
            }
          >
            <AlertTitle>Error</AlertTitle>
            {message}
          </Alert>
        );
      }

      // Full error display
      return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 4, 
              textAlign: 'center',
              borderTop: '4px solid',
              borderColor: 'error.main'
            }}
          >
            <ErrorIcon 
              sx={{ 
                fontSize: 64, 
                color: 'error.main', 
                mb: 2 
              }} 
            />
            
            <Typography 
              variant="h4" 
              gutterBottom 
              sx={{ fontWeight: 600 }}
            >
              {title}
            </Typography>
            
            <Typography 
              variant="body1" 
              color="text.secondary" 
              paragraph
            >
              {message}
            </Typography>

            {errorCount > 2 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Multiple errors detected. The application may be unstable. 
                Consider refreshing the page.
              </Alert>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={this.handleReset}
                startIcon={<RefreshIcon />}
                size="large"
              >
                Try Again
              </Button>
              
              {showHomeButton && (
                <Button
                  variant="outlined"
                  onClick={this.handleGoHome}
                  startIcon={<HomeIcon />}
                  size="large"
                >
                  Go Home
                </Button>
              )}
              
              {showReportButton && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    // Implement bug report functionality
                    console.log('Report bug:', error);
                  }}
                  startIcon={<BugIcon />}
                  size="large"
                >
                  Report Issue
                </Button>
              )}
            </Box>

            {/* Error details section */}
            {process.env.NODE_ENV === 'development' && (
              <Box sx={{ mt: 4 }}>
                <Button
                  onClick={this.toggleDetails}
                  endIcon={showDetails ? <CollapseIcon /> : <ExpandIcon />}
                  sx={{ mb: 2 }}
                >
                  {showDetails ? 'Hide' : 'Show'} Error Details
                </Button>
                
                <Collapse in={showDetails}>
                  <Paper 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'grey.100', 
                      textAlign: 'left',
                      maxHeight: 400,
                      overflow: 'auto'
                    }}
                  >
                    <Typography 
                      variant="subtitle2" 
                      gutterBottom 
                      sx={{ fontWeight: 600 }}
                    >
                      Error Message:
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontFamily: 'monospace', 
                        mb: 2,
                        color: 'error.main'
                      }}
                    >
                      {error && error.toString()}
                    </Typography>
                    
                    <Typography 
                      variant="subtitle2" 
                      gutterBottom 
                      sx={{ fontWeight: 600 }}
                    >
                      Component Stack:
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.75rem'
                      }}
                    >
                      {errorInfo && errorInfo.componentStack}
                    </Typography>
                  </Paper>
                </Collapse>
              </Box>
            )}
          </Paper>
        </Container>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  return (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
};

// Hook for error handling (to be used with ErrorBoundary)
export const useErrorHandler = () => {
  return (error) => {
    throw error; // This will be caught by the nearest ErrorBoundary
  };
};

export default ErrorBoundary;