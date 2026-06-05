/**
 * Loading State Utilities
 * Provides spinners, skeleton loaders, and progress indicators (UX-LOADING-001)
 * Includes ARIA announcements for screen readers
 */

import * as React from 'react';

/**
 * Loading state types
 */
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
  COMPLETED = 'completed',
}

/**
 * Spinner animation types
 */
export enum SpinnerType {
  CIRCULAR = 'circular',
  DOTS = 'dots',
  PULSE = 'pulse',
  BOUNCE = 'bounce',
  BARS = 'bars',
}

/**
 * Skeleton animation types
 */
export enum SkeletonAnimation {
  PULSE = 'pulse',
  WAVE = 'wave',
  SHIMMER = 'shimmer',
  NONE = 'none',
}

/**
 * Progress bar style
 */
export enum ProgressBarStyle {
  LINEAR = 'linear',
  CIRCULAR = 'circular',
  STRIPED = 'striped',
}

/**
 * Loading state context configuration
 */
export interface LoadingContextConfig {
  isLoading: boolean;
  message?: string;
  progress?: number; // 0-100
  error?: string;
  canCancel?: boolean;
  onCancel?: () => void;
}

/**
 * Create and manage loading state
 */
export class LoadingManager {
  private loadingState: LoadingState = LoadingState.IDLE;
  private message: string = '';
  private progress: number = 0;
  private error: string = '';
  private announcer: HTMLElement | null = null;

  constructor() {
    this.ensureAnnouncer();
  }

  /**
   * Ensure aria-live announcer element exists
   */
  private ensureAnnouncer(): void {
    if (this.announcer) return;

    this.announcer = document.getElementById('loading-announcer');
    if (!this.announcer) {
      this.announcer = document.createElement('div');
      this.announcer.id = 'loading-announcer';
      this.announcer.setAttribute('aria-live', 'polite');
      this.announcer.setAttribute('aria-atomic', 'true');
      this.announcer.className = 'sr-only'; // Screen reader only
      document.body.appendChild(this.announcer);
    }
  }

  /**
   * Set loading state
   */
  setLoading(message?: string): void {
    this.loadingState = LoadingState.LOADING;
    this.message = message || 'Loading...';
    this.progress = 0;
    this.announce(this.message);
  }

  /**
   * Set success state
   */
  setSuccess(message?: string): void {
    this.loadingState = LoadingState.SUCCESS;
    this.message = message || 'Success!';
    this.progress = 100;
    this.announce(this.message);
  }

  /**
   * Set error state
   */
  setError(error: string): void {
    this.loadingState = LoadingState.ERROR;
    this.error = error;
    this.message = '';
    this.announce(`Error: ${error}`);
  }

  /**
   * Update progress
   */
  setProgress(progress: number, message?: string): void {
    this.progress = Math.max(0, Math.min(100, progress));
    if (message) {
      this.message = message;
      // Only announce on significant progress changes
      if (this.progress % 25 === 0) {
        this.announce(`Loading: ${this.progress}% complete`);
      }
    }
  }

  /**
   * Reset to idle state
   */
  reset(): void {
    this.loadingState = LoadingState.IDLE;
    this.message = '';
    this.progress = 0;
    this.error = '';
  }

  /**
   * Announce message to screen readers
   */
  private announce(message: string): void {
    if (this.announcer) {
      this.announcer.textContent = message;
    }
  }

  /**
   * Get current state
   */
  getState(): LoadingState {
    return this.loadingState;
  }

  /**
   * Get current message
   */
  getMessage(): string {
    return this.message;
  }

  /**
   * Get current progress
   */
  getProgress(): number {
    return this.progress;
  }

  /**
   * Get current error
   */
  getError(): string {
    return this.error;
  }

  /**
   * Check if loading
   */
  isLoading(): boolean {
    return this.loadingState === LoadingState.LOADING;
  }
}

/**
 * React hook for managing loading state
 */
export function useLoadingState(
  initialMessage?: string
): [LoadingState, LoadingManager] {
  const [state, setState] = React.useState<LoadingState>(LoadingState.IDLE);
  const managerRef = React.useRef(new LoadingManager());

  React.useEffect(() => {
    const manager = managerRef.current;
    if (initialMessage) {
      manager.setLoading(initialMessage);
      setState(LoadingState.LOADING);
    }
  }, [initialMessage]);

  return [state, managerRef.current];
}

/**
 * Debounced loading state - avoids showing loader for fast operations
 */
export function useDebounceLoading(
  isLoading: boolean,
  delay: number = 500
): boolean {
  const [debouncedLoading, setDebouncedLoading] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  React.useEffect(() => {
    if (isLoading) {
      timeoutRef.current = setTimeout(() => {
        setDebouncedLoading(true);
      }, delay);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setDebouncedLoading(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, delay]);

  return debouncedLoading;
}

/**
 * Create skeleton loader configuration
 */
export interface SkeletonConfig {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  animation?: SkeletonAnimation;
  count?: number; // Number of skeleton lines
  lines?: Array<{ width?: string; height?: string }>;
}

/**
 * Generate skeleton loader classes
 */
export function generateSkeletonClasses(
  config: SkeletonConfig = {}
): string {
  const {
    animation = SkeletonAnimation.PULSE,
    borderRadius = '4px',
  } = config;

  return `skeleton skeleton-${animation} ${
    borderRadius ? `skeleton-radius-${borderRadius.replace(/[^0-9]/g, '')}` : ''
  }`;
}

/**
 * Create multiple skeleton lines
 */
export function createSkeletonLines(
  count: number = 3,
  baseHeight: number = 16
): Array<{ width: string; height: string }> {
  const lines = [];
  for (let i = 0; i < count; i++) {
    lines.push({
      width: i === count - 1 ? '80%' : '100%', // Last line shorter
      height: `${baseHeight}px`,
    });
  }
  return lines;
}

/**
 * Progress bar configuration
 */
export interface ProgressBarConfig {
  value: number; // 0-100
  max?: number;
  style?: ProgressBarStyle;
  animated?: boolean;
  showLabel?: boolean;
  showPercentage?: boolean;
  color?: string;
  backgroundColor?: string;
  animated_speed?: 'slow' | 'normal' | 'fast';
}

/**
 * Get progress bar aria attributes
 */
export function getProgressAriaAttributes(
  config: ProgressBarConfig
): Record<string, string | number> {
  return {
    'aria-valuenow': config.value,
    'aria-valuemin': 0,
    'aria-valuemax': config.max || 100,
    'aria-label': `Progress: ${config.value}%`,
    'role': 'progressbar',
  };
}

/**
 * Calculate animation duration based on progress speed
 */
export function getAnimationDuration(
  speed: 'slow' | 'normal' | 'fast' = 'normal'
): number {
  return {
    slow: 1.5,
    normal: 0.6,
    fast: 0.3,
  }[speed];
}

/**
 * Determine if loading spinner should show
 * Avoids showing loader for very quick operations
 */
export function shouldShowLoader(
  isLoading: boolean,
  timeElapsed: number,
  minimumTime: number = 500
): boolean {
  return isLoading && timeElapsed >= minimumTime;
}

/**
 * Format time for display
 */
export function formatLoadingTime(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`;
  }
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

/**
 * Create loading overlay configuration
 */
export interface LoadingOverlayConfig {
  isVisible: boolean;
  message?: string;
  spinner?: SpinnerType;
  blocking?: boolean; // Block interactions
  backdropOpacity?: number; // 0-1
  showMessage?: boolean;
  showProgress?: boolean;
  progress?: number;
  zIndex?: number;
}

/**
 * Manage focus during loading overlay
 */
export function manageFocusWithLoadingOverlay(
  isVisible: boolean,
  overlayRef: React.RefObject<HTMLElement>
): void {
  if (isVisible && overlayRef.current) {
    // Save current focus
    const previousActiveElement = document.activeElement as HTMLElement;

    // Move focus to overlay or first focusable element within
    const focusableElements = overlayRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    } else {
      overlayRef.current.focus();
    }

    // Store previous focus for restoration
    (overlayRef.current as any).previousActiveElement = previousActiveElement;
  } else if (overlayRef.current) {
    // Restore focus
    const previousFocus = (overlayRef.current as any).previousActiveElement;
    if (previousFocus && previousFocus.focus) {
      previousFocus.focus();
    }
  }
}

/**
 * Hook for managing loading overlay focus
 */
export function useLoadingOverlayFocus(
  isVisible: boolean
): React.RefObject<HTMLElement> {
  const overlayRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    manageFocusWithLoadingOverlay(isVisible, overlayRef);
  }, [isVisible]);

  return overlayRef;
}

/**
 * Generate loading animation CSS
 */
export function generateSpinnerCSS(type: SpinnerType): string {
  const baseCSS = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    @keyframes wave {
      0% { background-position: -1000px 0; }
      100% { background-position: 1000px 0; }
    }
  `;

  const typeCSS = {
    [SpinnerType.CIRCULAR]: `
      .spinner-circular {
        animation: spin 1s linear infinite;
        border: 4px solid var(--color-border-light);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        width: 40px;
        height: 40px;
      }
    `,
    [SpinnerType.DOTS]: `
      .spinner-dots {
        animation: pulse 0.6s ease-in-out infinite;
      }
      .spinner-dots::before {
        content: '.';
        animation: pulse 0.6s ease-in-out infinite;
      }
      .spinner-dots::after {
        content: '...';
        animation: pulse 0.6s ease-in-out 0.1s infinite;
      }
    `,
    [SpinnerType.PULSE]: `
      .spinner-pulse {
        animation: pulse 1.5s ease-in-out infinite;
        opacity: 0.6;
      }
    `,
    [SpinnerType.BOUNCE]: `
      .spinner-bounce {
        animation: bounce 1s ease-in-out infinite;
      }
    `,
    [SpinnerType.BARS]: `
      .spinner-bars {
        display: flex;
        gap: 4px;
        align-items: flex-end;
      }
      .spinner-bars span {
        width: 4px;
        height: 20px;
        background-color: var(--color-primary);
        animation: bounce 0.6s ease-in-out infinite;
      }
      .spinner-bars span:nth-child(2) {
        animation-delay: 0.1s;
      }
      .spinner-bars span:nth-child(3) {
        animation-delay: 0.2s;
      }
    `,
  };

  return baseCSS + (typeCSS[type] || '');
}

/**
 * Estimate remaining time based on progress
 */
export function estimateRemainingTime(
  currentProgress: number,
  elapsedTime: number // in milliseconds
): number | null {
  if (currentProgress <= 0 || currentProgress >= 100) {
    return null;
  }

  const rate = currentProgress / elapsedTime;
  const remainingProgress = 100 - currentProgress;
  return Math.round(remainingProgress / rate);
}

/**
 * Validate loading state configuration
 */
export function validateLoadingConfig(
  config: LoadingContextConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.progress !== undefined) {
    if (config.progress < 0 || config.progress > 100) {
      errors.push('Progress must be between 0 and 100');
    }
  }

  if (config.error && config.isLoading) {
    errors.push('Cannot be loading and have an error simultaneously');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a loading boundary component wrapper
 */
export interface LoadingBoundaryConfig {
  isLoading: boolean;
  fallback?: React.ReactNode;
  spinnerType?: SpinnerType;
  message?: string;
  showOverlay?: boolean;
  blocking?: boolean;
}
