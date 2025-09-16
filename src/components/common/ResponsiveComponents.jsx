/**
 * Mobile-first responsive components for Hospital Scheduler
 * Ensures consistent UI/UX across all devices
 */

import React from 'react';
import {
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Paper,
  Table,
  TableContainer,
  useTheme,
  useMediaQuery,
  Box,
  IconButton,
  Drawer,
  SwipeableDrawer
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

// Responsive breakpoints
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920
};

// Standardized button with consistent sizing and mobile optimization
export const ResponsiveButton = styled(Button)(({ theme, variant, priority }) => ({
  minHeight: 44, // Minimum touch target
  minWidth: theme.breakpoints.down('sm') ? '100%' : 120,
  padding: theme.spacing(1.5, 2),
  fontSize: '1rem',
  fontWeight: 600,
  borderRadius: theme.shape.borderRadius,
  textTransform: 'none',
  transition: 'all 0.3s ease',
  
  // Priority-based styling
  ...(priority === 'high' && {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.error.dark,
      transform: 'scale(1.02)'
    }
  }),
  
  ...(priority === 'medium' && {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.warning.dark
    }
  }),
  
  // Mobile-specific styles
  [theme.breakpoints.down('sm')]: {
    width: '100%',
    fontSize: '1.125rem',
    padding: theme.spacing(2),
    '&:active': {
      transform: 'scale(0.98)'
    }
  },
  
  // Accessibility
  '&:focus-visible': {
    outline: `3px solid ${theme.palette.primary.main}`,
    outlineOffset: 2
  },
  
  // Loading state
  '&.loading': {
    opacity: 0.7,
    pointerEvents: 'none'
  }
}));

// Responsive card with mobile optimization
export const ResponsiveCard = styled(Card)(({ theme }) => ({
  width: '100%',
  marginBottom: theme.spacing(2),
  borderRadius: theme.spacing(1.5),
  boxShadow: theme.shadows[2],
  transition: 'all 0.3s ease',
  
  '&:hover': {
    boxShadow: theme.shadows[4],
    transform: 'translateY(-2px)'
  },
  
  [theme.breakpoints.down('sm')]: {
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
    boxShadow: theme.shadows[1]
  }
}));

// Mobile-optimized data table
export const ResponsiveTable = ({ columns, data, onRowClick }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  if (isMobile) {
    // Mobile view - cards instead of table
    return (
      <Box sx={{ width: '100%' }}>
        {data.map((row, index) => (
          <ResponsiveCard 
            key={index}
            onClick={() => onRowClick?.(row)}
            sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
          >
            <CardContent>
              {columns.map((col) => (
                <Box key={col.field} sx={{ mb: 1 }}>
                  <strong>{col.headerName}:</strong> {row[col.field]}
                </Box>
              ))}
            </CardContent>
          </ResponsiveCard>
        ))}
      </Box>
    );
  }
  
  // Desktop view - traditional table
  return (
    <TableContainer component={Paper}>
      <Table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.field}>{col.headerName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr 
              key={index}
              onClick={() => onRowClick?.(row)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((col) => (
                <td key={col.field}>{row[col.field]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </TableContainer>
  );
};

// Loading skeleton for better UX
export const LoadingSkeleton = ({ variant = 'text', width, height, count = 1 }) => {
  const skeletons = [];
  
  for (let i = 0; i < count; i++) {
    skeletons.push(
      <Box
        key={i}
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          borderRadius: variant === 'circular' ? '50%' : 1,
          width: width || '100%',
          height: height || (variant === 'text' ? 20 : 60),
          marginBottom: 1,
          animation: 'pulse 1.5s ease-in-out infinite',
          '@keyframes pulse': {
            '0%': { opacity: 1 },
            '50%': { opacity: 0.4 },
            '100%': { opacity: 1 }
          }
        }}
      />
    );
  }
  
  return <>{skeletons}</>;
};

// Toast notification component
export const Toast = ({ message, severity = 'info', open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const colors = {
    success: theme.palette.success.main,
    error: theme.palette.error.main,
    warning: theme.palette.warning.main,
    info: theme.palette.info.main
  };
  
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            bottom: isMobile ? 16 : 24,
            left: isMobile ? 16 : 'auto',
            right: isMobile ? 16 : 24,
            zIndex: 9999
          }}
        >
          <Paper
            elevation={6}
            sx={{
              p: 2,
              backgroundColor: colors[severity],
              color: 'white',
              borderRadius: 2,
              minWidth: isMobile ? 'auto' : 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>{message}</span>
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: 'white', ml: 2 }}
            >
              ×
            </IconButton>
          </Paper>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Mobile navigation drawer
export const MobileNav = ({ open, onClose, menuItems }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  if (!isMobile) return null;
  
  return (
    <SwipeableDrawer
      anchor="left"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      sx={{
        '& .MuiDrawer-paper': {
          width: 280,
          backgroundColor: theme.palette.background.default
        }
      }}
    >
      <Box sx={{ p: 2 }}>
        {menuItems.map((item, index) => (
          <ResponsiveButton
            key={index}
            fullWidth
            variant="text"
            onClick={() => {
              item.onClick();
              onClose();
            }}
            sx={{ 
              justifyContent: 'flex-start',
              mb: 1,
              pl: 2
            }}
          >
            {item.icon && <Box sx={{ mr: 2 }}>{item.icon}</Box>}
            {item.label}
          </ResponsiveButton>
        ))}
      </Box>
    </SwipeableDrawer>
  );
};

// Responsive grid container
export const ResponsiveGrid = styled(Grid)(({ theme }) => ({
  [theme.breakpoints.down('sm')]: {
    '& .MuiGrid-item': {
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1)
    }
  }
}));

// Touch-optimized list item
export const TouchListItem = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  
  '&:active': {
    backgroundColor: theme.palette.action.selected
  },
  
  '&:hover': {
    backgroundColor: theme.palette.action.hover
  },
  
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2.5, 2),
    
    '&:active': {
      backgroundColor: theme.palette.action.selected,
      transform: 'scale(0.98)'
    }
  }
}));

// Floating action button for mobile
export const FloatingActionButton = styled(Button)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(2),
  right: theme.spacing(2),
  minWidth: 56,
  height: 56,
  borderRadius: '50%',
  boxShadow: theme.shadows[6],
  zIndex: 1000,
  
  [theme.breakpoints.up('md')]: {
    bottom: theme.spacing(3),
    right: theme.spacing(3)
  },
  
  '&:hover': {
    boxShadow: theme.shadows[8],
    transform: 'scale(1.05)'
  }
}));

// Responsive container with proper padding
export const ResponsiveContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(2),
  
  [theme.breakpoints.down('sm')]: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1)
  }
}));

// Error boundary component
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <ResponsiveCard>
          <CardContent>
            <h2>Something went wrong</h2>
            <p>Please refresh the page or contact support if the problem persists.</p>
            <ResponsiveButton
              onClick={() => window.location.reload()}
              variant="contained"
              color="primary"
            >
              Refresh Page
            </ResponsiveButton>
          </CardContent>
        </ResponsiveCard>
      );
    }
    
    return this.props.children;
  }
}

export default {
  ResponsiveButton,
  ResponsiveCard,
  ResponsiveTable,
  LoadingSkeleton,
  Toast,
  MobileNav,
  ResponsiveGrid,
  TouchListItem,
  FloatingActionButton,
  ResponsiveContainer,
  ErrorBoundary
};