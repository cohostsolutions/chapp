/**
 * Accessibility utilities for consistent a11y patterns across the app
 */

/**
 * Generates unique IDs for form field associations
 */
export function generateFieldId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Returns appropriate aria-describedby value for form fields with errors
 */
export function getAriaDescribedBy(
  fieldId: string, 
  hasError: boolean, 
  hasHelp: boolean
): string | undefined {
  const ids: string[] = [];
  if (hasError) ids.push(`${fieldId}-error`);
  if (hasHelp) ids.push(`${fieldId}-help`);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

/**
 * Screen reader only text styling
 */
export const srOnly = "sr-only";

/**
 * Focus visible ring styling
 */
export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Returns announcement for screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Keyboard navigation helpers
 */
export const KeyboardKeys = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const;

/**
 * Check if event is keyboard activation (Enter or Space)
 */
export function isKeyboardActivation(event: React.KeyboardEvent): boolean {
  return event.key === KeyboardKeys.ENTER || event.key === KeyboardKeys.SPACE;
}

/**
 * Handle keyboard click - triggers onClick for keyboard accessibility
 */
export function handleKeyboardClick(
  event: React.KeyboardEvent,
  onClick?: () => void
) {
  if (isKeyboardActivation(event)) {
    event.preventDefault();
    onClick?.();
  }
}

/**
 * Focus trap utilities
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  
  return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
}

/**
 * Create a focus trap within a container
 */
export function createFocusTrap(container: HTMLElement) {
  const focusable = getFocusableElements(container);
  const firstElement = focusable[0];
  const lastElement = focusable[focusable.length - 1];
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };
  
  container.addEventListener('keydown', handleKeyDown);
  firstElement?.focus();
  
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Common ARIA labels
 */
export const AriaLabels = {
  close: 'Close',
  open: 'Open',
  menu: 'Menu',
  search: 'Search',
  loading: 'Loading',
  submit: 'Submit',
  cancel: 'Cancel',
  delete: 'Delete',
  edit: 'Edit',
  save: 'Save',
  add: 'Add',
  remove: 'Remove',
  expand: 'Expand',
  collapse: 'Collapse',
  previous: 'Previous',
  next: 'Next',
  notifications: 'Notifications',
  settings: 'Settings',
  profile: 'Profile',
  logout: 'Log out',
  sidebar: 'Sidebar navigation',
  mainContent: 'Main content',
  toggleTheme: 'Toggle theme',
} as const;