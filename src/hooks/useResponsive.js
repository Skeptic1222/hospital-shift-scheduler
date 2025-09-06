import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

// Custom hook for responsive design
export function useResponsive() {
  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isLargeDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  // Touch device detection
  const isTouchDevice = useMediaQuery('(pointer: coarse)');

  // Orientation
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isLandscape = useMediaQuery('(orientation: landscape)');

  // Specific breakpoint values
  const isXs = useMediaQuery(theme.breakpoints.only('xs'));
  const isSm = useMediaQuery(theme.breakpoints.only('sm'));
  const isMd = useMediaQuery(theme.breakpoints.only('md'));
  const isLg = useMediaQuery(theme.breakpoints.only('lg'));
  const isXl = useMediaQuery(theme.breakpoints.only('xl'));

  // Combined queries
  const isMobileOrTablet = isMobile || isTablet;
  const isTabletOrDesktop = isTablet || isDesktop;

  return {
    // Basic breakpoints
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,

    // Specific sizes
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,

    // Combined
    isMobileOrTablet,
    isTabletOrDesktop,

    // Device capabilities
    isTouchDevice,

    // Orientation
    isPortrait,
    isLandscape,

    // Helper functions
    getValue: (mobileValue, tabletValue, desktopValue) => {
      if (isMobile) return mobileValue;
      if (isTablet) return tabletValue;
      return desktopValue;
    },

    getBreakpointValue: (values) => {
      const { xs, sm, md, lg, xl } = values;
      if (isXs && xs !== undefined) return xs;
      if (isSm && sm !== undefined) return sm;
      if (isMd && md !== undefined) return md;
      if (isLg && lg !== undefined) return lg;
      if (isXl && xl !== undefined) return xl;
      return values.default || values.xs || values.sm || values.md;
    }
  };
}

// Responsive component wrapper
export function ResponsiveBox({
  mobile,
  tablet,
  desktop,
  children,
  ...props
}) {
  const { isMobile, isTablet } = useResponsive();

  const responsiveProps = {
    ...props,
    ...(isMobile && mobile ? mobile : {}),
    ...(isTablet && tablet ? tablet : {}),
    ...(!isMobile && !isTablet && desktop ? desktop : {})
  };

  return children(responsiveProps);
}

// Responsive grid utilities
export function getResponsiveGridProps(isMobile, isTablet) {
  return {
    container: {
      spacing: isMobile ? 1 : isTablet ? 2 : 3,
      direction: isMobile ? 'column' : 'row'
    },
    item: {
      xs: 12,
      sm: isTablet ? 6 : 12,
      md: 4,
      lg: 3
    }
  };
}

// Touch-optimized props
export function getTouchProps(isTouchDevice) {
  return isTouchDevice ? {
    minHeight: 48,
    minWidth: 48,
    padding: 2,
    fontSize: '1rem'
  } : {};
}

export default useResponsive;
