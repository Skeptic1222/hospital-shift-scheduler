import { createTheme, responsiveFontSizes } from '@mui/material/styles';

// Design tokens for consistency
export const tokens = {
  spacing: {
    touchTarget: 44, // Minimum touch target size (WCAG AAA)
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 12,
  },
  transitions: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
};

// Create base theme
let theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      light: '#60a5fa',
      dark: '#1e40af',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
      contrastText: '#ffffff',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
    },
    info: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
    },
    success: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
    },
    background: {
      default: '#f9fafb',
      paper: '#ffffff',
    },
    text: {
      primary: '#111827',
      secondary: '#6b7280',
      disabled: '#9ca3af',
    },
    // Healthcare-specific semantic colors
    medical: {
      urgent: '#dc2626',
      critical: '#ea580c',
      stable: '#16a34a',
      observation: '#ca8a04',
      shift: {
        day: '#fbbf24',
        evening: '#fb923c',
        night: '#7c3aed',
      },
    },
  },

  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',

    // Responsive headers
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      lineHeight: 1.2,
      '@media (max-width:600px)': {
        fontSize: '2rem',
      },
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.4,
      '@media (max-width:600px)': {
        fontSize: '1.25rem',
      },
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
      lineHeight: 1.4,
      '@media (max-width:600px)': {
        fontSize: '1.125rem',
      },
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.5,
      '@media (max-width:600px)': {
        fontSize: '1rem',
      },
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
      '@media (max-width:600px)': {
        fontSize: '0.875rem',
      },
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'none', // Better readability
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  },

  spacing: 8, // Base spacing unit

  shape: {
    borderRadius: tokens.borderRadius.medium,
  },

  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },

  components: {
    // Global component overrides for consistency
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: tokens.spacing.touchTarget,
          minWidth: 88,
          borderRadius: tokens.borderRadius.medium,
          textTransform: 'none',
          fontWeight: 500,
          padding: '10px 16px',
          transition: `all ${tokens.transitions.normal}ms ease`,

          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          },

          '&:focus-visible': {
            outline: '2px solid',
            outlineOffset: 2,
          },

          '@media (pointer: coarse)': {
            minHeight: 48,
          },
        },
        sizeSmall: {
          minHeight: 36,
          fontSize: '0.75rem',
          padding: '6px 12px',
        },
        sizeLarge: {
          minHeight: 52,
          fontSize: '1rem',
          padding: '12px 24px',
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'medium',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '&:hover fieldset': {
              borderColor: '#2563eb',
            },
          },
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: tokens.borderRadius.large,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          transition: `all ${tokens.transitions.normal}ms ease`,

          '&:hover': {
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: tokens.borderRadius.small,
          fontWeight: 500,
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: tokens.borderRadius.medium,
        },
      },
    },

    MuiContainer: {
      defaultProps: {
        maxWidth: 'lg',
      },
      styleOverrides: {
        root: {
          paddingLeft: tokens.spacing.md,
          paddingRight: tokens.spacing.md,

          '@media (max-width:600px)': {
            paddingLeft: tokens.spacing.sm,
            paddingRight: tokens.spacing.sm,
          },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: tokens.spacing.touchTarget,
          minHeight: tokens.spacing.touchTarget,

          '@media (pointer: coarse)': {
            minWidth: 48,
            minHeight: 48,
          },
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: tokens.borderRadius.medium,
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: tokens.borderRadius.large,
        },
      },
    },
  },
});

// Apply responsive font sizes
theme = responsiveFontSizes(theme);

// Dark theme variant
export const darkTheme = createTheme({
  ...theme,
  palette: {
    ...theme.palette,
    mode: 'dark',
    primary: {
      main: '#60a5fa',
      light: '#93bbfc',
      dark: '#2563eb',
      contrastText: '#000000',
    },
    secondary: {
      main: '#34d399',
      light: '#6ee7b7',
      dark: '#10b981',
      contrastText: '#000000',
    },
    background: {
      default: '#111827',
      paper: '#1f2937',
    },
    text: {
      primary: '#f9fafb',
      secondary: '#d1d5db',
      disabled: '#6b7280',
    },
  },
});

export default theme;
