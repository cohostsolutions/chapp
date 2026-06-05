/**
 * Focus Management Utilities
 * Provides helpers for managing focus for accessibility (A11Y-002)
 * Handles focus trapping, restoration, and announcements
 */

/**
 * Store previous focus element to restore later
 */
let previouslyFocusedElement: HTMLElement | null = null;

/**
 * Save the currently focused element
 * Useful for restoring focus after a dialog closes
 */
export function saveFocus(): HTMLElement | null {
  previouslyFocusedElement = document.activeElement as HTMLElement;
  return previouslyFocusedElement;
}

/**
 * Restore focus to previously saved element
 * Returns true if focus was restored, false if no saved element
 */
export function restoreFocus(): boolean {
  if (previouslyFocusedElement) {
    previouslyFocusedElement.focus();
    previouslyFocusedElement = null;
    return true;
  }
  return false;
}

/**
 * Focus an element with optional announcement
 */
export function focusElement(
  element: HTMLElement | null,
  options?: {
    announce?: string;
    smooth?: boolean;
  }
) {
  if (!element) return;

  // Announce the focus change if requested
  if (options?.announce) {
    announceToScreenReader(options.announce);
  }

  // Wait for next frame if smooth scrolling is requested
  if (options?.smooth) {
    requestAnimationFrame(() => {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  } else {
    element.focus();
  }
}

/**
 * Announce a message to screen readers via aria-live region
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  // Get or create aria-live region
  let liveRegion = document.getElementById('aria-live-region');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'aria-live-region';
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    document.body.appendChild(liveRegion);
  }

  // Update priority if different
  liveRegion.setAttribute('aria-live', priority);

  // Clear and set new message
  liveRegion.textContent = message;
}

/**
 * Options for focus trap
 */
export interface FocusTrapOptions {
  initialFocus?: 'first' | 'last' | HTMLElement | (() => HTMLElement);
  returnFocus?: boolean;
  allowOutsideClick?: boolean;
  escapeDeactivates?: boolean;
}

/**
 * Focus Trap Manager
 * Traps focus within an element (useful for modals, dropdowns, etc.)
 */
export class FocusTrap {
  private element: HTMLElement;
  private options: FocusTrapOptions;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private isActive: boolean = false;

  constructor(element: HTMLElement, options: FocusTrapOptions = {}) {
    this.element = element;
    this.options = {
      initialFocus: 'first',
      returnFocus: true,
      allowOutsideClick: false,
      escapeDeactivates: true,
      ...options,
    };
  }

  /**
   * Activate the focus trap
   */
  activate() {
    if (this.isActive) return;

    // Save current focus for restoration
    if (this.options.returnFocus) {
      saveFocus();
    }

    // Focus initial element
    this.focusInitialElement();

    // Set up keyboard trap
    this.keyHandler = this.handleKeydown.bind(this);
    this.element.addEventListener('keydown', this.keyHandler);

    this.isActive = true;
  }

  /**
   * Deactivate the focus trap
   */
  deactivate() {
    if (!this.isActive) return;

    // Remove keyboard handler
    if (this.keyHandler) {
      this.element.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }

    // Restore previous focus
    if (this.options.returnFocus) {
      restoreFocus();
    }

    this.isActive = false;
  }

  /**
   * Focus the initial element
   */
  private focusInitialElement() {
    const { initialFocus } = this.options;

    let element: HTMLElement | null = null;

    if (typeof initialFocus === 'string') {
      if (initialFocus === 'first') {
        element = this.getFirstFocusable();
      } else if (initialFocus === 'last') {
        element = this.getLastFocusable();
      }
    } else if (typeof initialFocus === 'function') {
      element = initialFocus();
    } else if (initialFocus instanceof HTMLElement) {
      element = initialFocus;
    }

    if (element) {
      element.focus();
    }
  }

  /**
   * Handle keyboard navigation within the trap
   */
  private handleKeydown(event: KeyboardEvent) {
    // Handle Escape key if configured
    if (this.options.escapeDeactivates && event.key === 'Escape') {
      event.preventDefault();
      this.deactivate();
      return;
    }

    // Handle Tab key to trap focus
    if (event.key === 'Tab') {
      const focusables = this.getFocusableElements();
      if (focusables.length === 0) return;

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        // Shift+Tab from first wraps to last
        if (activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab from last wraps to first
        if (activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  /**
   * Get all focusable elements within the trap
   */
  private getFocusableElements(): HTMLElement[] {
    const selector = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    return Array.from(this.element.querySelectorAll(selector));
  }

  /**
   * Get the first focusable element
   */
  private getFirstFocusable(): HTMLElement | null {
    const elements = this.getFocusableElements();
    return elements.length > 0 ? elements[0] : null;
  }

  /**
   * Get the last focusable element
   */
  private getLastFocusable(): HTMLElement | null {
    const elements = this.getFocusableElements();
    return elements.length > 0 ? elements[elements.length - 1] : null;
  }

  /**
   * Check if trap is currently active
   */
  isActivated(): boolean {
    return this.isActive;
  }
}

/**
 * React Hook for focus trap
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement>, options?: FocusTrapOptions) {
  const [trapInstance] = React.useState<FocusTrap | null>(() => 
    ref.current ? new FocusTrap(ref.current, options) : null
  );

  React.useEffect(() => {
    if (trapInstance) {
      trapInstance.activate();
      return () => {
        trapInstance.deactivate();
      };
    }
  }, [trapInstance]);
}

/**
 * React Hook for managing focus
 */
export function useFocus() {
  const ref = React.useRef<HTMLElement>(null);

  const focus = React.useCallback((options?: { announce?: string; smooth?: boolean }) => {
    if (ref.current) {
      focusElement(ref.current, options);
    }
  }, []);

  const focusElement = React.useCallback((element: HTMLElement | null, options?: { announce?: string; smooth?: boolean }) => {
    if (element) {
      focusElement(element, options);
    }
  }, []);

  return { ref, focus, focusElement };
}

/**
 * Utility to check if an element is visible and should receive focus
 */
export function isVisibleAndFocusable(element: HTMLElement): boolean {
  if (!element) return false;

  // Check if element is hidden
  if (element.offsetParent === null) return false;

  // Check if element is disabled
  if ((element as any).disabled) return false;

  // Check if element is focusable
  const focusableSelectors = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];

  return focusableSelectors.some((selector) => element.matches(selector));
}

/**
 * Set focus visible state for an element (for focus indicators)
 */
export function setFocusVisible(element: HTMLElement, visible: boolean) {
  if (visible) {
    element.setAttribute('data-focus-visible', 'true');
  } else {
    element.removeAttribute('data-focus-visible');
  }
}

/**
 * Get all elements that should be announced to screen readers
 */
export function getAriaLabeledElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[aria-label], [aria-labelledby]'));
}

/**
 * Validate ARIA attributes for accessibility
 */
export function validateAriaAttributes(element: HTMLElement): string[] {
  const errors: string[] = [];

  // Check for aria-label on interactive elements
  if (['BUTTON', 'A', 'INPUT'].includes(element.tagName)) {
    const ariaLabel = element.getAttribute('aria-label');
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    const textContent = element.textContent?.trim();

    if (!ariaLabel && !ariaLabelledBy && !textContent) {
      errors.push(`${element.tagName} is missing accessible label`);
    }
  }

  // Check for aria-live regions
  if (element.getAttribute('aria-live')) {
    const ariaAtomic = element.getAttribute('aria-atomic');
    if (!ariaAtomic) {
      errors.push('aria-live region should have aria-atomic attribute');
    }
  }

  return errors;
}

// Import React for hooks
import React from 'react';
