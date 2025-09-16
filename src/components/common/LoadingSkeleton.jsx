import { useState, useEffect } from 'react';
import { 
  Skeleton, 
  Box, 
  Card, 
  CardContent, 
  Grid,
  Stack,
  Fade,
  LinearProgress
} from '@mui/material';
import { useResponsive } from '../../hooks/useResponsive';

// Generic loading skeleton component
const LoadingSkeleton = ({ 
  variant = 'rectangular',
  width = '100%',
  height = 20,
  animation = 'pulse',
  sx = {},
  ...props 
}) => {
  return (
    <Skeleton
      variant={variant}
      width={width}
      height={height}
      animation={animation}
      sx={sx}
      {...props}
    />
  );
};

// Table skeleton
export const TableSkeleton = ({ rows = 5, columns = 4 }) => {
  const { isMobile } = useResponsive();
  
  return (
    <Box sx={{ width: '100%' }}>
      <LinearProgress sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton 
            key={index} 
            variant="text" 
            width={`${100 / columns}%`} 
            height={40} 
          />
        ))}
      </Box>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box key={rowIndex} sx={{ display: 'flex', gap: 2, mb: 1 }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              variant="rectangular" 
              width={`${100 / columns}%`} 
              height={50} 
            />
          ))}
        </Box>
      ))}
    </Box>
  );
};

// Card skeleton
export const CardSkeleton = ({ showActions = true }) => {
  return (
    <Card>
      <CardContent>
        <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
        <Skeleton variant="text" width="100%" height={20} />
        <Skeleton variant="text" width="100%" height={20} />
        <Skeleton variant="text" width="75%" height={20} sx={{ mb: 2 }} />
        {showActions && (
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Skeleton variant="rectangular" width={100} height={36} />
            <Skeleton variant="rectangular" width={100} height={36} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// List skeleton
export const ListSkeleton = ({ items = 5, showAvatar = true, showActions = false }) => {
  return (
    <Stack spacing={2}>
      {Array.from({ length: items }).map((_, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {showAvatar && (
            <Skeleton variant="circular" width={40} height={40} />
          )}
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={16} />
          </Box>
          {showActions && (
            <Skeleton variant="rectangular" width={80} height={32} />
          )}
        </Box>
      ))}
    </Stack>
  );
};

// Form skeleton
export const FormSkeleton = ({ fields = 4 }) => {
  return (
    <Stack spacing={3}>
      {Array.from({ length: fields }).map((_, index) => (
        <Box key={index}>
          <Skeleton variant="text" width={120} height={16} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" width="100%" height={56} />
        </Box>
      ))}
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Skeleton variant="rectangular" width={120} height={42} />
        <Skeleton variant="rectangular" width={120} height={42} />
      </Box>
    </Stack>
  );
};

// Dashboard skeleton
export const DashboardSkeleton = () => {
  const { isMobile } = useResponsive();
  
  return (
    <Box sx={{ width: '100%' }}>
      <Skeleton variant="text" width={250} height={40} sx={{ mb: 3 }} />
      
      <Grid container spacing={3}>
        {/* Stats cards */}
        {Array.from({ length: 4 }).map((_, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="60%" height={20} />
                <Skeleton variant="text" width="40%" height={32} sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
        
        {/* Chart */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width={150} height={24} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" width="100%" height={300} />
            </CardContent>
          </Card>
        </Grid>
        
        {/* Side panel */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width={120} height={24} sx={{ mb: 2 }} />
              <ListSkeleton items={4} showAvatar={false} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

// Profile skeleton
export const ProfileSkeleton = () => {
  return (
    <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Skeleton variant="circular" width={100} height={100} sx={{ mr: 3 }} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="text" width={150} height={20} sx={{ mt: 1 }} />
        </Box>
      </Box>
      <FormSkeleton fields={6} />
    </Box>
  );
};

// Calendar skeleton
export const CalendarSkeleton = () => {
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Skeleton variant="text" width={200} height={32} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Skeleton variant="rectangular" width={100} height={36} />
          <Skeleton variant="rectangular" width={100} height={36} />
        </Box>
      </Box>
      
      <Grid container spacing={1}>
        {Array.from({ length: 35 }).map((_, index) => (
          <Grid item xs={12 / 7} key={index}>
            <Skeleton 
              variant="rectangular" 
              width="100%" 
              height={80} 
              sx={{ mb: 0.5 }}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

// Shimmer effect wrapper
export const ShimmerSkeleton = ({ children, loading = true, fade = true }) => {
  if (!loading) return children;
  
  return (
    <Fade in={loading} timeout={500}>
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        {children}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
            animation: 'shimmer 1.5s infinite',
            '@keyframes shimmer': {
              '0%': { transform: 'translateX(-100%)' },
              '100%': { transform: 'translateX(100%)' }
            }
          }}
        />
      </Box>
    </Fade>
  );
};

// Text skeleton with realistic line lengths
export const TextSkeleton = ({ lines = 3, paragraph = true }) => {
  const widths = ['100%', '95%', '75%', '85%', '90%', '70%'];
  
  return (
    <Box sx={{ width: '100%' }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton 
          key={index}
          variant="text" 
          width={widths[index % widths.length]} 
          height={20}
          sx={{ mb: paragraph ? 1 : 0.5 }}
        />
      ))}
    </Box>
  );
};

// Image gallery skeleton
export const GallerySkeleton = ({ items = 6, columns = 3 }) => {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: items }).map((_, index) => (
        <Grid item xs={12 / columns} key={index}>
          <Skeleton 
            variant="rectangular" 
            width="100%" 
            height={200}
            sx={{ borderRadius: 1 }}
          />
        </Grid>
      ))}
    </Grid>
  );
};

// Navigation skeleton
export const NavigationSkeleton = () => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
      <Skeleton variant="text" width={150} height={32} sx={{ mr: 'auto' }} />
      <Box sx={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} variant="text" width={80} height={24} />
        ))}
      </Box>
      <Skeleton variant="circular" width={40} height={40} sx={{ ml: 2 }} />
    </Box>
  );
};

// Custom skeleton hook for progressive loading
export const useProgressiveSkeleton = (loading, delay = 300) => {
  const [showSkeleton, setShowSkeleton] = useState(loading);
  
  useEffect(() => {
    let timer;
    if (loading) {
      setShowSkeleton(true);
    } else {
      timer = setTimeout(() => {
        setShowSkeleton(false);
      }, delay);
    }
    return () => clearTimeout(timer);
  }, [loading, delay]);
  
  return showSkeleton;
};

export default LoadingSkeleton;