//
import { Button, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';

// Standardized button component with consistent sizing and styling
const StyledButton = styled(Button)(({ theme, priority = 'normal', fullWidth }) => ({
  // Consistent minimum sizes for accessibility
  minHeight: 44, // Touch target minimum
  minWidth: fullWidth ? '100%' : 88, // Material Design minimum

  // Consistent padding
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),

  // Prevent text overflow
  maxWidth: fullWidth ? '100%' : 320,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',

  // Consistent font sizing
  fontSize: '0.875rem',
  fontWeight: 500,
  textTransform: 'none', // Better readability

  // Consistent border radius
  borderRadius: theme.spacing(1),

  // Consistent transitions
  transition: theme.transitions.create(['background-color', 'box-shadow', 'transform'], {
    duration: theme.transitions.duration.short,
  }),

  // Hover effects
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },

  // Focus states for accessibility
  '&:focus': {
    outline: '2px solid',
    outlineColor: theme.palette.primary.main,
    outlineOffset: 2,
  },

  // Disabled state
  '&:disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },

  // Priority-based styling
  ...(priority === 'high' && {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.error.dark,
    },
  }),

  ...(priority === 'urgent' && {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
    animation: 'pulse 2s infinite',
    '@keyframes pulse': {
      '0%': {
        boxShadow: `0 0 0 0 ${theme.palette.warning.main}40`,
      },
      '70%': {
        boxShadow: '0 0 0 10px rgba(255, 152, 0, 0)',
      },
      '100%': {
        boxShadow: '0 0 0 0 rgba(255, 152, 0, 0)',
      },
    },
  }),

  // Mobile optimization
  '@media (pointer: coarse)': {
    minHeight: 48,
    fontSize: '1rem',
  },

  // Responsive design
  [theme.breakpoints.down('sm')]: {
    minWidth: fullWidth ? '100%' : 64,
    fontSize: '0.875rem',
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
  },
}));

const StandardButton = ({
  children,
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  priority = 'normal',
  loading = false,
  startIcon,
  endIcon,
  fullWidth = false,
  disabled = false,
  onClick,
  type = 'button',
  ariaLabel,
  ...props
}) => {
  // Size mapping for consistency
  const sizeStyles = {
    small: { minHeight: 36, fontSize: '0.75rem' },
    medium: { minHeight: 44, fontSize: '0.875rem' },
    large: { minHeight: 52, fontSize: '1rem' },
  };

  return (
    <StyledButton
      variant={variant}
      color={priority === 'high' || priority === 'urgent' ? 'inherit' : color}
      size={size}
      priority={priority}
      fullWidth={fullWidth}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
      endIcon={!loading && endIcon}
      sx={sizeStyles[size]}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </StyledButton>
  );
};

export default StandardButton;
