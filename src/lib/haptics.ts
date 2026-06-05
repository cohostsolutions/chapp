/**
 * Haptic Feedback Utility
 * Provides native-like haptic feedback for web apps
 */

import { devWarn } from './logger';

export type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

interface HapticOptions {
  duration?: number;
  intensity?: number;
}

/**
 * Check if device supports vibration
 */
export function isHapticSupported(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback
 */
export function triggerHaptic(type: HapticFeedbackType = 'light', options: HapticOptions = {}): void {
  if (!isHapticSupported()) {
    return;
  }

  // Get vibration pattern based on type
  const pattern = getVibrationPattern(type, options);
  
  if (pattern) {
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      devWarn('Haptic feedback failed:', error);
    }
  }
}

/**
 * Get vibration pattern for feedback type
 */
function getVibrationPattern(type: HapticFeedbackType, options: HapticOptions): number | number[] {
  const { duration, intensity = 1 } = options;

  // Base patterns (in milliseconds)
  const patterns: Record<HapticFeedbackType, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    selection: 5,
    success: [10, 50, 10],
    warning: [20, 100, 20],
    error: [30, 100, 30, 100, 30],
  };

  let pattern = patterns[type];

  // Apply custom duration if provided
  if (duration) {
    pattern = duration;
  }

  // Apply intensity scaling
  if (intensity !== 1) {
    if (Array.isArray(pattern)) {
      pattern = pattern.map(value => Math.round(value * intensity));
    } else {
      pattern = Math.round(pattern * intensity);
    }
  }

  return pattern;
}

/**
 * Haptic feedback hooks for common interactions
 */
export const hapticFeedback = {
  /**
   * Light tap feedback (for buttons, links)
   */
  tap: () => triggerHaptic('light'),

  /**
   * Medium feedback (for toggle switches, checkboxes)
   */
  toggle: () => triggerHaptic('medium'),

  /**
   * Heavy feedback (for important actions, confirmations)
   */
  impact: () => triggerHaptic('heavy'),

  /**
   * Selection feedback (for pickers, selects)
   */
  select: () => triggerHaptic('selection'),

  /**
   * Success feedback (for successful operations)
   */
  success: () => triggerHaptic('success'),

  /**
   * Warning feedback (for warnings, cautions)
   */
  warning: () => triggerHaptic('warning'),

  /**
   * Error feedback (for errors, failures)
   */
  error: () => triggerHaptic('error'),

  /**
   * Custom vibration pattern
   */
  custom: (pattern: number | number[]) => {
    if (isHapticSupported()) {
      try {
        navigator.vibrate(pattern);
      } catch (error) {
        devWarn('Haptic feedback failed (custom):', error);
      }
    }
  },

  /**
   * Cancel ongoing vibration
   */
  cancel: () => {
    if (isHapticSupported()) {
      try {
        navigator.vibrate(0);
      } catch (error) {
        devWarn('Haptic cancel failed:', error);
      }
    }
  },
};

/**
 * React hook for haptic feedback
 */
export function useHaptic() {
  return {
    isSupported: isHapticSupported(),
    trigger: triggerHaptic,
    ...hapticFeedback,
  };
}

/**
 * HOC to add haptic feedback to click events
 */
export function withHaptic<T extends HTMLElement>(
  element: T,
  type: HapticFeedbackType = 'light'
): T {
  const originalOnClick = element.onclick;
  
  element.onclick = (event) => {
    triggerHaptic(type);
    if (originalOnClick) {
      originalOnClick.call(element, event);
    }
  };

  return element;
}

/**
 * Add haptic feedback to form interactions
 */
export function enableFormHaptics(form: HTMLFormElement): void {
  // Button clicks
  const buttons = form.querySelectorAll('button, input[type="submit"]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => triggerHaptic('light'));
  });

  // Input focus
  const inputs = form.querySelectorAll('input, textarea, select');
  inputs.forEach((input) => {
    input.addEventListener('focus', () => triggerHaptic('selection'));
  });

  // Checkbox/radio toggles
  const toggles = form.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  toggles.forEach((toggle) => {
    toggle.addEventListener('change', () => triggerHaptic('medium'));
  });

  // Range sliders
  const ranges = form.querySelectorAll('input[type="range"]');
  ranges.forEach((range) => {
    let lastValue = (range as HTMLInputElement).value;
    range.addEventListener('input', (e) => {
      const currentValue = (e.target as HTMLInputElement).value;
      if (currentValue !== lastValue) {
        triggerHaptic('selection');
        lastValue = currentValue;
      }
    });
  });
}

/**
 * Add haptic feedback to navigation
 */
export function enableNavigationHaptics(): void {
  // Add to all navigation links
  const navLinks = document.querySelectorAll('nav a, [role="navigation"] a');
  navLinks.forEach((link) => {
    link.addEventListener('click', () => triggerHaptic('light'));
  });

  // Add to back button if exists
  const backButtons = document.querySelectorAll('[aria-label*="back"], .back-button');
  backButtons.forEach((button) => {
    button.addEventListener('click', () => triggerHaptic('medium'));
  });
}

/**
 * Enable haptics globally for common UI interactions
 */
export function enableGlobalHaptics(): void {
  // Buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      triggerHaptic('light');
    }
  }, true);

  // Links
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' || target.closest('a')) {
      triggerHaptic('light');
    }
  }, true);

  // Form submissions
  document.addEventListener('submit', () => {
    triggerHaptic('medium');
  }, true);
}

export default hapticFeedback;
