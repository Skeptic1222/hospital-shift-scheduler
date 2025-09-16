import { useState, useEffect } from 'react';
import { Box, Button, Link, Typography, styled } from '@mui/material';
import { KeyboardArrowDown as ArrowIcon } from '@mui/icons-material';

// Styled skip link that appears on focus
const SkipLink = styled(Link)(({ theme }) => ({
  position: 'absolute',
  left: '-10000px',
  top: 'auto',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  zIndex: theme.zIndex.tooltip + 100,
  
  '&:focus, &:focus-visible': {
    position: 'fixed',
    left: theme.spacing(2),
    top: theme.spacing(2),
    width: 'auto',
    height: 'auto',
    padding: theme.spacing(1.5, 3),
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    textDecoration: 'none',
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[4],
    fontSize: '1rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    animation: 'slideIn 0.2s ease-out',
    
    '@keyframes slideIn': {
      from: {
        transform: 'translateY(-100%)',
        opacity: 0
      },
      to: {
        transform: 'translateY(0)',
        opacity: 1
      }
    },
    
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
      textDecoration: 'none'
    }
  }
}));

// Skip to content component with multiple targets
const SkipToContent = ({ 
  mainId = 'main-content',
  navId = 'main-navigation',
  searchId = 'search',
  customLinks = []
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  const defaultLinks = [
    { href: `#${mainId}`, text: 'Skip to main content', primary: true },
    { href: `#${navId}`, text: 'Skip to navigation' },
    { href: `#${searchId}`, text: 'Skip to search' }
  ];
  
  const links = [...defaultLinks, ...customLinks].filter(link => {
    // Check if target element exists
    if (typeof document !== 'undefined') {
      const target = document.querySelector(link.href);
      return !!target;
    }
    return true;
  });
  
  // Handle skip link click
  const handleSkip = (e, href) => {
    e.preventDefault();
    const targetId = href.replace('#', '');
    const target = document.getElementById(targetId);
    
    if (target) {
      // Set focus to target
      target.setAttribute('tabindex', '-1');
      target.focus();
      
      // Scroll to target
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Announce to screen readers
      const message = `Navigated to ${targetId.replace('-', ' ')}`;
      announceToScreenReader(message);
    }
  };
  
  // Announce message to screen readers
  const announceToScreenReader = (message) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };
  
  // Show skip links menu
  const showSkipMenu = () => {
    setIsVisible(true);
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt + S to show skip menu
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        showSkipMenu();
      }
      
      // Escape to hide menu
      if (e.key === 'Escape' && isVisible) {
        setIsVisible(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);
  
  return (
    <>
      {/* Primary skip link - always available */}
      {links.filter(link => link.primary).map((link, index) => (
        <SkipLink
          key={index}
          href={link.href}
          onClick={(e) => handleSkip(e, link.href)}
          component="a"
        >
          {link.text}
          <ArrowIcon />
        </SkipLink>
      ))}
      
      {/* Skip links menu for additional options */}
      {isVisible && links.length > 1 && (
        <Box
          sx={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 9999,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            boxShadow: 3,
            p: 2,
            minWidth: 200
          }}
          role="navigation"
          aria-label="Skip links menu"
        >
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {links.map((link, index) => (
              <Box component="li" key={index} sx={{ mb: 1 }}>
                <Button
                  fullWidth
                  variant={link.primary ? 'contained' : 'text'}
                  onClick={(e) => {
                    handleSkip(e, link.href);
                    setIsVisible(false);
                  }}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  {link.text}
                </Button>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </>
  );
};

// Landmark navigation component
export const LandmarkNavigation = () => {
  const [landmarks, setLandmarks] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  
  useEffect(() => {
    // Find all ARIA landmarks
    const findLandmarks = () => {
      const landmarkRoles = ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search'];
      const found = [];
      
      landmarkRoles.forEach(role => {
        const elements = document.querySelectorAll(`[role="${role}"]`);
        elements.forEach(el => {
          const label = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || role;
          found.push({
            element: el,
            role,
            label
          });
        });
      });
      
      // Also find HTML5 semantic elements
      const semanticElements = {
        header: 'banner',
        nav: 'navigation',
        main: 'main',
        aside: 'complementary',
        footer: 'contentinfo'
      };
      
      Object.entries(semanticElements).forEach(([tag, role]) => {
        const elements = document.querySelectorAll(tag);
        elements.forEach(el => {
          // Don't duplicate if already has role
          if (!el.getAttribute('role')) {
            const label = el.getAttribute('aria-label') || role;
            found.push({
              element: el,
              role,
              label
            });
          }
        });
      });
      
      setLandmarks(found);
    };
    
    findLandmarks();
    
    // Update on DOM changes
    const observer = new MutationObserver(findLandmarks);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  }, []);
  
  const navigateToLandmark = (landmark) => {
    landmark.element.setAttribute('tabindex', '-1');
    landmark.element.focus();
    landmark.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setShowMenu(false);
  };
  
  // Keyboard shortcut to show menu
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt + L for landmarks
      if (e.altKey && e.key === 'l') {
        e.preventDefault();
        setShowMenu(true);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  if (!showMenu || landmarks.length === 0) return null;
  
  return (
    <Box
      sx={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'background.paper',
        borderRadius: 2,
        boxShadow: 4,
        p: 3,
        zIndex: 9999,
        minWidth: 300,
        maxWidth: 400
      }}
      role="dialog"
      aria-label="Navigate to landmark"
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6">Jump to Section</Typography>
        <Typography variant="caption" color="text.secondary">
          Use arrow keys to navigate, Enter to select, Escape to close
        </Typography>
      </Box>
      
      <Box component="nav">
        {landmarks.map((landmark, index) => (
          <Button
            key={index}
            fullWidth
            variant="text"
            onClick={() => navigateToLandmark(landmark)}
            sx={{
              justifyContent: 'flex-start',
              mb: 0.5,
              textTransform: 'none'
            }}
          >
            <Box>
              <Typography variant="body2">{landmark.label}</Typography>
              <Typography variant="caption" color="text.secondary">
                {landmark.role}
              </Typography>
            </Box>
          </Button>
        ))}
      </Box>
      
      <Button
        fullWidth
        variant="outlined"
        onClick={() => setShowMenu(false)}
        sx={{ mt: 2 }}
      >
        Close (Esc)
      </Button>
    </Box>
  );
};

// Heading navigation component
export const HeadingNavigation = () => {
  const [headings, setHeadings] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  useEffect(() => {
    // Find all headings
    const updateHeadings = () => {
      const found = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      setHeadings(found);
    };
    
    updateHeadings();
    
    // Listen for changes
    const observer = new MutationObserver(updateHeadings);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  }, []);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      // H key to jump to next heading
      if (e.key === 'h' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Check if we're in an input field
        const activeElement = document.activeElement;
        if (activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.contentEditable === 'true') {
          return;
        }
        
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % headings.length;
        if (headings[nextIndex]) {
          headings[nextIndex].setAttribute('tabindex', '-1');
          headings[nextIndex].focus();
          headings[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
          setCurrentIndex(nextIndex);
        }
      }
      
      // Shift + H to jump to previous heading
      if (e.key === 'H' && e.shiftKey) {
        e.preventDefault();
        const prevIndex = currentIndex === -1 ? headings.length - 1 : 
                         (currentIndex - 1 + headings.length) % headings.length;
        if (headings[prevIndex]) {
          headings[prevIndex].setAttribute('tabindex', '-1');
          headings[prevIndex].focus();
          headings[prevIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
          setCurrentIndex(prevIndex);
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [headings, currentIndex]);
  
  return null; // This component doesn't render anything visible
};

export default SkipToContent;