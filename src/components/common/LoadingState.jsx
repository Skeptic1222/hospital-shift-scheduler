//
import { Box, CircularProgress, Typography, Skeleton, Stack } from '@mui/material';

// Reusable loading state component
export const LoadingSpinner = ({ message = 'Loading...', size = 40 }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '200px',
      p: 3,
    }}
  >
    <CircularProgress size={size} />
    {message && (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 2 }}
      >
        {message}
      </Typography>
    )}
  </Box>
);

// Skeleton loader for cards
export const CardSkeleton = ({ count = 1 }) => (
  <Stack spacing={2}>
    {Array.from({ length: count }).map((_, index) => (
      <Box key={index}>
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
        <Skeleton variant="text" sx={{ mt: 1 }} />
        <Skeleton variant="text" width="60%" />
      </Box>
    ))}
  </Stack>
);

// Skeleton loader for tables
export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <Box>
    <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <Box key={rowIndex} sx={{ display: 'flex', gap: 1, mb: 1 }}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton
            key={colIndex}
            variant="text"
            sx={{ flex: 1 }}
            height={40}
          />
        ))}
      </Box>
    ))}
  </Box>
);

// Full page loading overlay
export const LoadingOverlay = ({ open = false, message = 'Processing...' }) => {
  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
    >
      <Box
        sx={{
          backgroundColor: 'background.paper',
          borderRadius: 2,
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: 24,
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          {message}
        </Typography>
      </Box>
    </Box>
  );
};

export default LoadingSpinner;
