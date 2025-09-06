import React from 'react';
import { Box, Container } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useResponsive } from '../../hooks/useResponsive';

// Responsive container with proper padding and margins for all devices
const StyledContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(2),

  [theme.breakpoints.down('sm')]: {
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },

  [theme.breakpoints.up('md')]: {
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3),
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(3),
  },

  // Ensure content doesn't get cut off on small screens
  overflowX: 'hidden',
  width: '100%',
  boxSizing: 'border-box',
}));

// Responsive box with mobile-first design
export const ResponsiveBox = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',

  // Prevent horizontal overflow on mobile
  [theme.breakpoints.down('sm')]: {
    overflowX: 'auto',
    '-webkit-overflow-scrolling': 'touch', // Smooth scrolling on iOS
  },
}));

// Card container optimized for different screen sizes
export const ResponsiveCard = styled(Box)(({ theme }) => ({
  width: '100%',
  marginBottom: theme.spacing(2),

  [theme.breakpoints.down('sm')]: {
    borderRadius: 0,
    marginLeft: -theme.spacing(1),
    marginRight: -theme.spacing(1),
    width: `calc(100% + ${theme.spacing(2)})`,
  },

  [theme.breakpoints.up('sm')]: {
    borderRadius: theme.spacing(1),
  },
}));

// Responsive grid container
export const ResponsiveGrid = ({ children, ...props }) => {
  const { isMobile, isTablet } = useResponsive();

  return (
    <Box
      sx={{
        display: 'grid',
        gap: isMobile ? 1 : isTablet ? 2 : 3,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
          lg: 'repeat(4, 1fr)',
        },
        ...props.sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
};

// Flex container with responsive direction
export const ResponsiveFlex = ({ children, vertical = false, ...props }) => {
  const { isMobile } = useResponsive();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: vertical || isMobile ? 'column' : 'row',
        gap: isMobile ? 1 : 2,
        alignItems: vertical || isMobile ? 'stretch' : 'center',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        ...props.sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
};

// Stack with responsive spacing
export const ResponsiveStack = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),

  [theme.breakpoints.up('sm')]: {
    gap: theme.spacing(2),
  },

  [theme.breakpoints.up('md')]: {
    gap: theme.spacing(3),
  },
}));

// Button group with responsive layout
export const ResponsiveButtonGroup = ({ children, ...props }) => {
  const { isMobile } = useResponsive();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 1,
        '& > *': {
          flex: isMobile ? '1 1 100%' : '0 1 auto',
          minWidth: isMobile ? '100%' : 'auto',
        },
        ...props.sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
};

// Table container with horizontal scroll on mobile
export const ResponsiveTableContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  overflowX: 'auto',
  '-webkit-overflow-scrolling': 'touch',

  '& table': {
    minWidth: 600,

    [theme.breakpoints.down('sm')]: {
      fontSize: '0.875rem',
    },
  },

  // Add shadow indicators for scrollable content
  '&::-webkit-scrollbar': {
    height: 8,
  },
  '&::-webkit-scrollbar-track': {
    background: theme.palette.action.hover,
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.action.selected,
    borderRadius: 4,
  },
}));

// Dialog with responsive sizing
export const ResponsiveDialog = styled(Box)(({ theme }) => ({
  '& .MuiDialog-paper': {
    margin: theme.spacing(1),
    width: 'calc(100% - 16px)',
    maxWidth: '100%',

    [theme.breakpoints.up('sm')]: {
      margin: theme.spacing(2),
      width: 'calc(100% - 32px)',
      maxWidth: 600,
    },

    [theme.breakpoints.up('md')]: {
      margin: theme.spacing(4),
      width: 'auto',
      maxWidth: 800,
    },
  },
}));

// Form container with responsive layout
export const ResponsiveForm = styled('form')(({ theme }) => ({
  width: '100%',
  '& .MuiTextField-root': {
    marginBottom: theme.spacing(2),
  },

  [theme.breakpoints.down('sm')]: {
    '& .MuiTextField-root': {
      width: '100%',
    },
  },
}));

// Navigation container that adapts to screen size
export const ResponsiveNav = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1, 2),

  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'stretch',
    '& > *': {
      marginBottom: theme.spacing(1),
    },
  },

  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(2, 3),
  },
}));

export default StyledContainer;
