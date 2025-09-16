// Browser error logging utility
const logError = (error, errorInfo = {}) => {
  const errorData = {
    message: error?.message || String(error),
    stack: error?.stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    ...errorInfo
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Application Error:', errorData);
  }

  // Send to server
  fetch('/api/browser-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      level: 'error',
      ...errorData
    })
  }).catch(err => {
    console.error('Failed to send error to server:', err);
  });
};

// Global error handler
window.addEventListener('error', (event) => {
  logError(event.error || event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    type: 'uncaught-error'
  });
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  logError(event.reason, {
    type: 'unhandled-rejection',
    promise: String(event.promise)
  });
});

export default logError;