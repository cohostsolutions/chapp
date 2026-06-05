/**
 * Keyboard Navigation Utilities
 * Provides helpers for implementing keyboard navigation (A11Y-002)
 * Supports Tab, Shift+Tab, Enter, Escape, and Arrow keys
 */

/**
 * Enum of keyboard keys for navigation
 */
export enum KeyboardKey {
  TAB = 'Tab',
  SHIFT_TAB = 'Shift+Tab',
  ENTER = 'Enter',
  SPACE = ' ',
  ESCAPE = 'Escape',
  ARROW_UP = 'ArrowUp',
  ARROW_DOWN = 'ArrowDown',
  ARROW_LEFT = 'ArrowLeft',
  ARROW_RIGHT = 'ArrowRight',
  HOME = 'Home',
  END = 'End',
  PAGE_UP = 'PageUp',
  PAGE_DOWN = 'PageDown',
}

/**
 * Configuration for keyboard event handling
 */
export interface KeyboardConfig {
  preventDefault?: boolean;
  stopPropagation?: boolean;
  callback?: () => void;
}

/**
 * Keyboard handler registry for organizing multiple handlers
 */
export class KeyboardHandler {
  private handlers: Map<string, (event: KeyboardEvent) => void> = new Map();

  /**
   * Register a handler for a specific key combination
   * @param key - The key to listen for (e.g., 'Enter', 'Escape')
   * @param handler - Function to call when key is pressed
   */
  register(key: KeyboardKey | string, handler: (event: KeyboardEvent) => void) {
    this.handlers.set(key, handler);
  }

  /**
   * Handle keyboard event and dispatch to registered handlers
   */
  handle(event: KeyboardEvent) {
    const key = this.getKeyName(event);
    const handler = this.handlers.get(key);
    
    if (handler) {
      handler(event);
    }
  }

  /**
   * Get the key name from a keyboard event
   */
  private getKeyName(event: KeyboardEvent): string {
    if (event.shiftKey && event.key === 'Tab') {
      return 'Shift+Tab';
    }
    return event.key;
  }

  /**
   * Clear all registered handlers
   */
  clear() {
    this.handlers.clear();
  }
}

/**
 * Check if a keyboard event matches a specific key
 * @param event - The keyboard event
 * @param key - The key to check for
 * @returns true if the event matches the key
 */
export function isKey(event: KeyboardEvent, key: KeyboardKey | string): boolean {
  if (key === KeyboardKey.TAB && event.key === 'Tab' && !event.shiftKey) {
    return true;
  }
  if (key === KeyboardKey.SHIFT_TAB && event.key === 'Tab' && event.shiftKey) {
    return true;
  }
  return event.key === key;
}

/**
 * Check if Enter or Space key was pressed (for button activation)
 */
export function isActivationKey(event: KeyboardEvent): boolean {
  return isKey(event, KeyboardKey.ENTER) || isKey(event, KeyboardKey.SPACE);
}

/**
 * Check if Tab key was pressed
 */
export function isTabKey(event: KeyboardEvent): boolean {
  return event.key === 'Tab';
}

/**
 * Check if Escape key was pressed
 */
export function isEscapeKey(event: KeyboardEvent): boolean {
  return isKey(event, KeyboardKey.ESCAPE);
}

/**
 * Check if arrow key was pressed
 */
export function isArrowKey(event: KeyboardEvent): boolean {
  return [
    KeyboardKey.ARROW_UP,
    KeyboardKey.ARROW_DOWN,
    KeyboardKey.ARROW_LEFT,
    KeyboardKey.ARROW_RIGHT,
  ].includes(event.key as KeyboardKey);
}

/**
 * Check if Home key was pressed
 */
export function isHomeKey(event: KeyboardEvent): boolean {
  return isKey(event, KeyboardKey.HOME);
}

/**
 * Check if End key was pressed
 */
export function isEndKey(event: KeyboardEvent): boolean {
  return isKey(event, KeyboardKey.END);
}

/**
 * Handle common keyboard patterns in keyboard handlers
 */
export const keyboardPatterns = {
  /**
   * Handle dismiss (Escape key) - for modals, dropdowns, etc.
   */
  handleDismiss(event: KeyboardEvent, onDismiss: () => void, config?: KeyboardConfig) {
    if (isEscapeKey(event)) {
      if (config?.preventDefault) event.preventDefault();
      if (config?.stopPropagation) event.stopPropagation();
      onDismiss();
    }
  },

  /**
   * Handle activation (Enter or Space) - for buttons, links, etc.
   */
  handleActivation(
    event: KeyboardEvent,
    onActivate: () => void,
    config?: KeyboardConfig
  ) {
    if (isActivationKey(event)) {
      if (config?.preventDefault) event.preventDefault();
      if (config?.stopPropagation) event.stopPropagation();
      onActivate();
    }
  },

  /**
   * Handle arrow key navigation
   */
  handleArrowNavigation(
    event: KeyboardEvent,
    options: {
      onUp?: () => void;
      onDown?: () => void;
      onLeft?: () => void;
      onRight?: () => void;
    },
    config?: KeyboardConfig
  ) {
    if (event.key === KeyboardKey.ARROW_UP && options.onUp) {
      if (config?.preventDefault) event.preventDefault();
      if (config?.stopPropagation) event.stopPropagation();
      options.onUp();
    } else if (event.key === KeyboardKey.ARROW_DOWN && options.onDown) {
      if (config?.preventDefault) event.preventDefault();
      if (config?.stopPropagation) event.stopPropagation();
      options.onDown();
    } else if (event.key === KeyboardKey.ARROW_LEFT && options.onLeft) {
      if (config?.preventDefault) event.preventDefault();
      if (config?.stopPropagation) event.stopPropagation();
      options.onLeft();
    } else if (event.key === KeyboardKey.ARROW_RIGHT && options.onRight) {
      if (config?.preventDefault) event.preventDefault();
      if (config?.stopPropagation) event.stopPropagation();
      options.onRight();
    }
  },

  /**
   * Handle list navigation (arrow keys for prev/next)
   */
  handleListNavigation(
    event: KeyboardEvent,
    options: {
      onPrev: () => void;
      onNext: () => void;
      onFirst?: () => void;
      onLast?: () => void;
    },
    config?: KeyboardConfig
  ) {
    if (isHomeKey(event) && options.onFirst) {
      if (config?.preventDefault) event.preventDefault();
      if (config?.stopPropagation) event.stopPropagation();
      options.onFirst();
    } else if (isEndKey(event) && options.onLast) {
      if (config?.preventDefault) event.preventDefault();
      if (config?.stopPropagation) event.stopPropagation();
      options.onLast();
    } else if (
      (event.key === KeyboardKey.ARROW_UP || event.key === KeyboardKey.ARROW_LEFT) &&
      options.onPrev
    ) {
      if (config?.preventDefault) event.preventDefault();
      if (config?.stopPropagation) event.stopPropagation();
      options.onPrev();
    } else if (
      (event.key === KeyboardKey.ARROW_DOWN || event.key === KeyboardKey.ARROW_RIGHT) &&
      options.onNext
    ) {
      if (config?.preventDefault) event.preventDefault();
      if (config?.stopPropagation) event.stopPropagation();
      options.onNext();
    }
  },
};

/**
 * Hook for handling keyboard events with trap detection
 * Useful for preventing keyboard events from propagating outside an element
 */
export function createKeyboardTrap(ref: React.RefObject<HTMLElement>) {
  return (event: KeyboardEvent) => {
    if (!ref.current) return;
    
    // Prevent Tab from leaving the element
    if (isTabKey(event)) {
      const focusableElements = ref.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      const activeElement = document.activeElement as HTMLElement;

      if (event.shiftKey) {
        // Shift+Tab from first element wraps to last
        if (activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab from last element wraps to first
        if (activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  };
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button',
    '[href]',
    'input',
    'select',
    'textarea',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
}

/**
 * Focus the first focusable element in a container
 */
export function focusFirstElement(container: HTMLElement): boolean {
  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    elements[0].focus();
    return true;
  }
  return false;
}

/**
 * Focus the last focusable element in a container
 */
export function focusLastElement(container: HTMLElement): boolean {
  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    elements[elements.length - 1].focus();
    return true;
  }
  return false;
}

/**
 * Get the next focusable element in a container
 */
export function getNextFocusableElement(container: HTMLElement): HTMLElement | null {
  const elements = getFocusableElements(container);
  const activeElement = document.activeElement as HTMLElement;

  const currentIndex = elements.indexOf(activeElement);
  if (currentIndex < elements.length - 1) {
    return elements[currentIndex + 1];
  }

  // Wrap to first element
  return elements.length > 0 ? elements[0] : null;
}

/**
 * Get the previous focusable element in a container
 */
export function getPreviousFocusableElement(container: HTMLElement): HTMLElement | null {
  const elements = getFocusableElements(container);
  const activeElement = document.activeElement as HTMLElement;

  const currentIndex = elements.indexOf(activeElement);
  if (currentIndex > 0) {
    return elements[currentIndex - 1];
  }

  // Wrap to last element
  return elements.length > 0 ? elements[elements.length - 1] : null;
}
