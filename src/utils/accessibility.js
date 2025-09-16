// Accessibility utilities and ARIA helpers

// ARIA live region announcements
export class AriaLiveAnnouncer {
  constructor() {
    this.announcer = null;
    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;
    
    // Create hidden live region
    this.announcer = document.createElement('div');
    this.announcer.setAttribute('role', 'status');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    document.body.appendChild(this.announcer);
  }

  announce(message, priority = 'polite') {
    if (!this.announcer) return;
    
    // Set priority
    this.announcer.setAttribute('aria-live', priority);
    
    // Clear previous announcement
    this.announcer.textContent = '';
    
    // Announce new message after a brief delay
    setTimeout(() => {
      this.announcer.textContent = message;
    }, 100);
  }

  destroy() {
    if (this.announcer && this.announcer.parentNode) {
      this.announcer.parentNode.removeChild(this.announcer);
    }
  }
}

// Keyboard navigation helpers
export const KeyCodes = {
  ENTER: 13,
  ESCAPE: 27,
  SPACE: 32,
  TAB: 9,
  ARROW_UP: 38,
  ARROW_DOWN: 40,
  ARROW_LEFT: 37,
  ARROW_RIGHT: 39,
  HOME: 36,
  END: 35,
  PAGE_UP: 33,
  PAGE_DOWN: 34
};

// Focus management
export const focusManagement = {
  // Trap focus within a container
  trapFocus: (container, initialFocus = null) => {
    const focusableElements = container.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    // Set initial focus
    if (initialFocus) {
      initialFocus.focus();
    } else if (firstFocusable) {
      firstFocusable.focus();
    }
    
    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
      
      if (e.key === 'Escape') {
        // Return focus to trigger element
        const trigger = container.getAttribute('data-focus-trigger');
        if (trigger) {
          const triggerElement = document.querySelector(trigger);
          if (triggerElement) {
            triggerElement.focus();
          }
        }
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    
    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  },

  // Save and restore focus
  saveFocus: () => {
    return document.activeElement;
  },

  restoreFocus: (element) => {
    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  },

  // Move focus to first error
  focusFirstError: (container = document) => {
    const errorElement = container.querySelector(
      '[aria-invalid="true"], .error, .MuiTextField-root.Mui-error input'
    );
    if (errorElement) {
      errorElement.focus();
      errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    }
    return false;
  }
};

// ARIA attributes helpers
export const ariaHelpers = {
  // Generate unique IDs for ARIA relationships
  generateId: (prefix = 'aria') => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Set up label relationships
  setupLabelledBy: (element, labelId) => {
    element.setAttribute('aria-labelledby', labelId);
  },

  // Set up description relationships
  setupDescribedBy: (element, descriptionId) => {
    element.setAttribute('aria-describedby', descriptionId);
  },

  // Toggle expanded state
  toggleExpanded: (element) => {
    const isExpanded = element.getAttribute('aria-expanded') === 'true';
    element.setAttribute('aria-expanded', !isExpanded);
    return !isExpanded;
  },

  // Update live region
  updateLiveRegion: (regionId, message, priority = 'polite') => {
    const region = document.getElementById(regionId);
    if (region) {
      region.setAttribute('aria-live', priority);
      region.textContent = message;
    }
  }
};

// Screen reader utilities
export const screenReaderUtils = {
  // Create visually hidden but screen reader accessible text
  visuallyHidden: {
    position: 'absolute',
    left: '-10000px',
    top: 'auto',
    width: '1px',
    height: '1px',
    overflow: 'hidden'
  },

  // Announce message to screen readers
  announce: (message, priority = 'polite') => {
    const announcer = new AriaLiveAnnouncer();
    announcer.announce(message, priority);
    setTimeout(() => announcer.destroy(), 1000);
  },

  // Create skip link
  createSkipLink: (targetId, text = 'Skip to main content') => {
    const link = document.createElement('a');
    link.href = `#${targetId}`;
    link.textContent = text;
    link.className = 'skip-link';
    link.style.cssText = `
      position: absolute;
      left: -10000px;
      top: auto;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    
    link.addEventListener('focus', () => {
      link.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        z-index: 9999;
        padding: 8px 16px;
        background: #000;
        color: #fff;
        text-decoration: none;
      `;
    });
    
    link.addEventListener('blur', () => {
      link.style.cssText = `
        position: absolute;
        left: -10000px;
        top: auto;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
    });
    
    return link;
  }
};

// Color contrast utilities
export const colorContrastUtils = {
  // Calculate relative luminance
  relativeLuminance: (rgb) => {
    const [r, g, b] = rgb.map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  },

  // Calculate contrast ratio
  contrastRatio: (rgb1, rgb2) => {
    const l1 = colorContrastUtils.relativeLuminance(rgb1);
    const l2 = colorContrastUtils.relativeLuminance(rgb2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  },

  // Check if contrast meets WCAG standards
  meetsWCAG: (rgb1, rgb2, level = 'AA', size = 'normal') => {
    const ratio = colorContrastUtils.contrastRatio(rgb1, rgb2);
    
    if (level === 'AAA') {
      return size === 'large' ? ratio >= 4.5 : ratio >= 7;
    } else {
      // AA level
      return size === 'large' ? ratio >= 3 : ratio >= 4.5;
    }
  },

  // Get best text color for background
  getBestTextColor: (bgRgb) => {
    const whiteContrast = colorContrastUtils.contrastRatio(bgRgb, [255, 255, 255]);
    const blackContrast = colorContrastUtils.contrastRatio(bgRgb, [0, 0, 0]);
    return whiteContrast > blackContrast ? '#ffffff' : '#000000';
  }
};

// Keyboard navigation patterns
export const keyboardPatterns = {
  // Roving tabindex for lists
  rovingTabindex: (container, itemSelector) => {
    const items = container.querySelectorAll(itemSelector);
    let currentIndex = 0;

    // Set initial tabindex
    items.forEach((item, index) => {
      item.setAttribute('tabindex', index === 0 ? '0' : '-1');
    });

    const handleKeyDown = (e) => {
      let handled = false;

      switch(e.keyCode) {
        case KeyCodes.ARROW_DOWN:
        case KeyCodes.ARROW_RIGHT:
          currentIndex = (currentIndex + 1) % items.length;
          handled = true;
          break;
        case KeyCodes.ARROW_UP:
        case KeyCodes.ARROW_LEFT:
          currentIndex = (currentIndex - 1 + items.length) % items.length;
          handled = true;
          break;
        case KeyCodes.HOME:
          currentIndex = 0;
          handled = true;
          break;
        case KeyCodes.END:
          currentIndex = items.length - 1;
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
        items.forEach((item, index) => {
          item.setAttribute('tabindex', index === currentIndex ? '0' : '-1');
        });
        items[currentIndex].focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  },

  // Grid navigation
  gridNavigation: (container, columns) => {
    const items = container.querySelectorAll('[role="gridcell"]');
    let currentIndex = 0;
    const rows = Math.ceil(items.length / columns);

    const handleKeyDown = (e) => {
      let newIndex = currentIndex;

      switch(e.keyCode) {
        case KeyCodes.ARROW_RIGHT:
          newIndex = Math.min(currentIndex + 1, items.length - 1);
          break;
        case KeyCodes.ARROW_LEFT:
          newIndex = Math.max(currentIndex - 1, 0);
          break;
        case KeyCodes.ARROW_DOWN:
          newIndex = Math.min(currentIndex + columns, items.length - 1);
          break;
        case KeyCodes.ARROW_UP:
          newIndex = Math.max(currentIndex - columns, 0);
          break;
        case KeyCodes.HOME:
          newIndex = currentIndex - (currentIndex % columns);
          break;
        case KeyCodes.END:
          newIndex = Math.min(
            currentIndex + (columns - 1 - (currentIndex % columns)),
            items.length - 1
          );
          break;
        case KeyCodes.PAGE_UP:
          newIndex = currentIndex % columns;
          break;
        case KeyCodes.PAGE_DOWN:
          newIndex = items.length - columns + (currentIndex % columns);
          newIndex = Math.min(newIndex, items.length - 1);
          break;
      }

      if (newIndex !== currentIndex) {
        e.preventDefault();
        currentIndex = newIndex;
        items[currentIndex].focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }
};

// High contrast mode detection
export const detectHighContrast = () => {
  if (typeof window === 'undefined') return false;
  
  const mediaQuery = window.matchMedia('(prefers-contrast: high)');
  return mediaQuery.matches;
};

// Reduced motion detection
export const detectReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
};

// Focus visible polyfill
export const setupFocusVisible = () => {
  if (typeof document === 'undefined') return;
  
  // Check if browser supports :focus-visible
  try {
    document.querySelector(':focus-visible');
    return; // Browser supports it natively
  } catch (e) {
    // Add polyfill
    let hadKeyboardEvent = true;
    const keyboardEvents = ['keydown', 'keyup'];
    const pointerEvents = ['mousedown', 'mouseup', 'touchstart', 'touchend'];
    
    keyboardEvents.forEach(event => {
      document.addEventListener(event, () => {
        hadKeyboardEvent = true;
      });
    });
    
    pointerEvents.forEach(event => {
      document.addEventListener(event, () => {
        hadKeyboardEvent = false;
      });
    });
    
    document.addEventListener('focus', (e) => {
      if (hadKeyboardEvent || e.target.matches(':focus-visible')) {
        e.target.classList.add('focus-visible');
      }
    }, true);
    
    document.addEventListener('blur', (e) => {
      e.target.classList.remove('focus-visible');
    }, true);
  }
};

export default {
  AriaLiveAnnouncer,
  KeyCodes,
  focusManagement,
  ariaHelpers,
  screenReaderUtils,
  colorContrastUtils,
  keyboardPatterns,
  detectHighContrast,
  detectReducedMotion,
  setupFocusVisible
};