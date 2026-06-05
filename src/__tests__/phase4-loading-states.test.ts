import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LoadingManager,
  LoadingState,
  SpinnerType,
  SkeletonAnimation,
  ProgressBarStyle,
  generateSkeletonClasses,
  createSkeletonLines,
  getProgressAriaAttributes,
  getAnimationDuration,
  shouldShowLoader,
  formatLoadingTime,
  estimateRemainingTime,
  validateLoadingConfig,
  generateSpinnerCSS,
} from '../lib/loadingStates';

describe('Loading State Utilities', () => {
  describe('LoadingManager', () => {
    let manager: LoadingManager;

    beforeEach(() => {
      manager = new LoadingManager();
    });

    afterEach(() => {
      // Clean up
      const announcer = document.getElementById('loading-announcer');
      if (announcer) {
        announcer.remove();
      }
    });

    it('should initialize with IDLE state', () => {
      expect(manager.getState()).toBe(LoadingState.IDLE);
    });

    it('should set loading state', () => {
      manager.setLoading('Please wait...');
      expect(manager.getState()).toBe(LoadingState.LOADING);
      expect(manager.getMessage()).toBe('Please wait...');
      expect(manager.isLoading()).toBe(true);
    });

    it('should set default loading message', () => {
      manager.setLoading();
      expect(manager.getMessage()).toBe('Loading...');
    });

    it('should set success state', () => {
      manager.setSuccess('Operation complete!');
      expect(manager.getState()).toBe(LoadingState.SUCCESS);
      expect(manager.getMessage()).toBe('Operation complete!');
    });

    it('should set error state', () => {
      manager.setError('Something went wrong');
      expect(manager.getState()).toBe(LoadingState.ERROR);
      expect(manager.getError()).toBe('Something went wrong');
    });

    it('should update progress', () => {
      manager.setLoading();
      manager.setProgress(50, 'Halfway there...');
      expect(manager.getProgress()).toBe(50);
    });

    it('should clamp progress between 0 and 100', () => {
      manager.setProgress(-10);
      expect(manager.getProgress()).toBe(0);

      manager.setProgress(150);
      expect(manager.getProgress()).toBe(100);
    });

    it('should reset state', () => {
      manager.setLoading('Test');
      manager.setProgress(75);
      manager.reset();

      expect(manager.getState()).toBe(LoadingState.IDLE);
      expect(manager.getMessage()).toBe('');
      expect(manager.getProgress()).toBe(0);
      expect(manager.getError()).toBe('');
    });

    it('should create ARIA live announcer', () => {
      manager.setLoading('Test message');
      const announcer = document.getElementById('loading-announcer');
      expect(announcer).toBeDefined();
      expect(announcer?.getAttribute('aria-live')).toBe('polite');
    });

    it('should reuse existing announcer', () => {
      manager.setLoading('First message');
      const firstAnnouncer = document.getElementById('loading-announcer');

      manager.reset();
      manager.setLoading('Second message');
      const secondAnnouncer = document.getElementById('loading-announcer');

      expect(firstAnnouncer).toBe(secondAnnouncer);
    });
  });

  describe('Skeleton Utilities', () => {
    it('should generate skeleton classes', () => {
      const classes = generateSkeletonClasses({
        animation: SkeletonAnimation.PULSE,
        borderRadius: '8px',
      });

      expect(classes).toContain('skeleton');
      expect(classes).toContain('skeleton-pulse');
    });

    it('should handle wave animation', () => {
      const classes = generateSkeletonClasses({
        animation: SkeletonAnimation.WAVE,
      });

      expect(classes).toContain('skeleton-wave');
    });

    it('should handle shimmer animation', () => {
      const classes = generateSkeletonClasses({
        animation: SkeletonAnimation.SHIMMER,
      });

      expect(classes).toContain('skeleton-shimmer');
    });

    it('should create skeleton lines', () => {
      const lines = createSkeletonLines(3, 16);

      expect(lines).toHaveLength(3);
      expect(lines[0].width).toBe('100%');
      expect(lines[2].width).toBe('80%'); // Last line shorter
      expect(lines[0].height).toBe('16px');
    });

    it('should create correct number of lines', () => {
      const lines5 = createSkeletonLines(5);
      expect(lines5).toHaveLength(5);

      const lines1 = createSkeletonLines(1);
      expect(lines1).toHaveLength(1);
    });

    it('should respect custom base height', () => {
      const lines = createSkeletonLines(2, 24);

      expect(lines[0].height).toBe('24px');
      expect(lines[1].height).toBe('24px');
    });
  });

  describe('Progress Bar Utilities', () => {
    it('should get progress ARIA attributes', () => {
      const attrs = getProgressAriaAttributes({
        value: 75,
        max: 100,
        style: ProgressBarStyle.LINEAR,
      });

      expect(attrs['aria-valuenow']).toBe(75);
      expect(attrs['aria-valuemin']).toBe(0);
      expect(attrs['aria-valuemax']).toBe(100);
      expect(attrs['role']).toBe('progressbar');
    });

    it('should use 100 as default max', () => {
      const attrs = getProgressAriaAttributes({ value: 50 });

      expect(attrs['aria-valuemax']).toBe(100);
    });

    it('should include aria-label', () => {
      const attrs = getProgressAriaAttributes({ value: 25 });

      expect(attrs['aria-label']).toContain('25');
    });
  });

  describe('Animation Duration', () => {
    it('should return slow speed duration', () => {
      expect(getAnimationDuration('slow')).toBe(1.5);
    });

    it('should return normal speed duration', () => {
      expect(getAnimationDuration('normal')).toBe(0.6);
    });

    it('should return fast speed duration', () => {
      expect(getAnimationDuration('fast')).toBe(0.3);
    });

    it('should use normal as default', () => {
      expect(getAnimationDuration()).toBe(0.6);
    });
  });

  describe('shouldShowLoader', () => {
    it('should show loader if loading and time elapsed', () => {
      const result = shouldShowLoader(true, 600, 500);
      expect(result).toBe(true);
    });

    it('should not show loader if not loading', () => {
      const result = shouldShowLoader(false, 600, 500);
      expect(result).toBe(false);
    });

    it('should not show loader if not enough time elapsed', () => {
      const result = shouldShowLoader(true, 100, 500);
      expect(result).toBe(false);
    });

    it('should respect custom minimum time', () => {
      const result = shouldShowLoader(true, 300, 300);
      expect(result).toBe(true);
    });

    it('should use default minimum time of 500ms', () => {
      const result = shouldShowLoader(true, 500);
      expect(result).toBe(true);
    });
  });

  describe('formatLoadingTime', () => {
    it('should format milliseconds', () => {
      expect(formatLoadingTime(123)).toBe('123ms');
    });

    it('should format seconds', () => {
      const result = formatLoadingTime(1500);
      expect(result).toContain('s');
      expect(result).not.toContain('ms');
    });

    it('should format minutes', () => {
      const result = formatLoadingTime(65000);
      expect(result).toContain('m');
    });

    it('should round to appropriate decimal places', () => {
      const seconds = formatLoadingTime(2500);
      expect(seconds).toBe('2.5s');
    });

    it('should handle edge cases', () => {
      expect(formatLoadingTime(0)).toBe('0ms');
      expect(formatLoadingTime(1000)).toContain('s');
    });
  });

  describe('estimateRemainingTime', () => {
    it('should calculate remaining time based on progress', () => {
      // If 50% done in 5000ms, should estimate 5000ms remaining
      const estimated = estimateRemainingTime(50, 5000);
      expect(estimated).toBeLessThan(10000);
      expect(estimated).toBeGreaterThan(0);
    });

    it('should return null for 0% progress', () => {
      expect(estimateRemainingTime(0, 1000)).toBeNull();
    });

    it('should return null for 100% progress', () => {
      expect(estimateRemainingTime(100, 5000)).toBeNull();
    });

    it('should estimate accurately', () => {
      // 25% done in 2500ms = 10 seconds total
      const estimated = estimateRemainingTime(25, 2500);
      expect(estimated).toBeCloseTo(7500, -2); // Within 100ms
    });

    it('should handle fast progress', () => {
      // 90% done very quickly
      const estimated = estimateRemainingTime(90, 100);
      expect(estimated).toBeLessThan(1000);
    });
  });

  describe('validateLoadingConfig', () => {
    it('should validate correct config', () => {
      const result = validateLoadingConfig({
        isLoading: true,
        progress: 50,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject progress outside 0-100', () => {
      const result1 = validateLoadingConfig({
        isLoading: true,
        progress: -10,
      });

      expect(result1.valid).toBe(false);
      expect(result1.errors[0]).toContain('0');
      expect(result1.errors[0]).toContain('100');

      const result2 = validateLoadingConfig({
        isLoading: true,
        progress: 150,
      });

      expect(result2.valid).toBe(false);
    });

    it('should reject loading with error simultaneously', () => {
      const result = validateLoadingConfig({
        isLoading: true,
        error: 'Something failed',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should allow error without loading', () => {
      const result = validateLoadingConfig({
        isLoading: false,
        error: 'Something failed',
      });

      expect(result.valid).toBe(true);
    });

    it('should allow progress 0 and 100', () => {
      const result0 = validateLoadingConfig({
        isLoading: true,
        progress: 0,
      });

      const result100 = validateLoadingConfig({
        isLoading: true,
        progress: 100,
      });

      expect(result0.valid).toBe(true);
      expect(result100.valid).toBe(true);
    });
  });

  describe('generateSpinnerCSS', () => {
    it('should generate CSS for circular spinner', () => {
      const css = generateSpinnerCSS(SpinnerType.CIRCULAR);
      expect(css).toContain('spinner-circular');
      expect(css).toContain('animation: spin');
    });

    it('should generate CSS for dots spinner', () => {
      const css = generateSpinnerCSS(SpinnerType.DOTS);
      expect(css).toContain('spinner-dots');
      expect(css).toContain('animation: pulse');
    });

    it('should generate CSS for pulse spinner', () => {
      const css = generateSpinnerCSS(SpinnerType.PULSE);
      expect(css).toContain('spinner-pulse');
    });

    it('should generate CSS for bounce spinner', () => {
      const css = generateSpinnerCSS(SpinnerType.BOUNCE);
      expect(css).toContain('spinner-bounce');
      expect(css).toContain('animation: bounce');
    });

    it('should generate CSS for bars spinner', () => {
      const css = generateSpinnerCSS(SpinnerType.BARS);
      expect(css).toContain('spinner-bars');
    });

    it('should include keyframe animations', () => {
      const css = generateSpinnerCSS(SpinnerType.CIRCULAR);
      expect(css).toContain('@keyframes spin');
      expect(css).toContain('@keyframes bounce');
      expect(css).toContain('@keyframes pulse');
    });

    it('should include animation properties', () => {
      const css = generateSpinnerCSS(SpinnerType.CIRCULAR);
      expect(css).toContain('animation:');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle quick operations (no loader shown)', () => {
      const shouldShow = shouldShowLoader(true, 100, 500);
      expect(shouldShow).toBe(false);
    });

    it('should handle long operations (loader shown)', () => {
      const shouldShow = shouldShowLoader(true, 1000, 500);
      expect(shouldShow).toBe(true);
    });

    it('should manage state through lifecycle', () => {
      const manager = new LoadingManager();

      // Start loading
      manager.setLoading('Fetching data...');
      expect(manager.isLoading()).toBe(true);

      // Update progress
      manager.setProgress(33, 'Validating...');
      expect(manager.getProgress()).toBe(33);

      // More progress
      manager.setProgress(66, 'Processing...');
      expect(manager.getProgress()).toBe(66);

      // Complete
      manager.setSuccess('Done!');
      expect(manager.getState()).toBe(LoadingState.SUCCESS);
      expect(manager.isLoading()).toBe(false);
    });

    it('should handle error state', () => {
      const manager = new LoadingManager();

      manager.setLoading();
      expect(manager.isLoading()).toBe(true);

      manager.setError('Network timeout');
      expect(manager.isLoading()).toBe(false);
      expect(manager.getState()).toBe(LoadingState.ERROR);
    });

    it('should estimate time for multi-step operation', () => {
      // 1st step: 25% in 5 seconds
      let estimate = estimateRemainingTime(25, 5000);
      expect(estimate).toBeCloseTo(15000, -2);

      // 2nd step: 50% in 10 seconds
      estimate = estimateRemainingTime(50, 10000);
      expect(estimate).toBeCloseTo(10000, -2);

      // 3rd step: 75% in 15 seconds
      estimate = estimateRemainingTime(75, 15000);
      expect(estimate).toBeCloseTo(5000, -2);
    });

    it('should format times for display', () => {
      expect(formatLoadingTime(250)).toContain('ms');
      expect(formatLoadingTime(2500)).toContain('s');
      expect(formatLoadingTime(65000)).toContain('m');
    });
  });

  describe('Loading States enum', () => {
    it('should have IDLE state', () => {
      expect(LoadingState.IDLE).toBe('idle');
    });

    it('should have LOADING state', () => {
      expect(LoadingState.LOADING).toBe('loading');
    });

    it('should have SUCCESS state', () => {
      expect(LoadingState.SUCCESS).toBe('success');
    });

    it('should have ERROR state', () => {
      expect(LoadingState.ERROR).toBe('error');
    });

    it('should have COMPLETED state', () => {
      expect(LoadingState.COMPLETED).toBe('completed');
    });
  });

  describe('SpinnerType enum', () => {
    it('should define all spinner types', () => {
      expect(SpinnerType.CIRCULAR).toBe('circular');
      expect(SpinnerType.DOTS).toBe('dots');
      expect(SpinnerType.PULSE).toBe('pulse');
      expect(SpinnerType.BOUNCE).toBe('bounce');
      expect(SpinnerType.BARS).toBe('bars');
    });
  });

  describe('SkeletonAnimation enum', () => {
    it('should define all animation types', () => {
      expect(SkeletonAnimation.PULSE).toBe('pulse');
      expect(SkeletonAnimation.WAVE).toBe('wave');
      expect(SkeletonAnimation.SHIMMER).toBe('shimmer');
      expect(SkeletonAnimation.NONE).toBe('none');
    });
  });

  describe('ProgressBarStyle enum', () => {
    it('should define all progress bar styles', () => {
      expect(ProgressBarStyle.LINEAR).toBe('linear');
      expect(ProgressBarStyle.CIRCULAR).toBe('circular');
      expect(ProgressBarStyle.STRIPED).toBe('striped');
    });
  });

  describe('Edge cases', () => {
    it('should handle 0ms elapsed time in estimation', () => {
      // Should not crash with 0 elapsed time
      const estimate = estimateRemainingTime(0, 0);
      expect(estimate).toBeNull();
    });

    it('should handle very small progress values', () => {
      const estimate = estimateRemainingTime(0.1, 100);
      expect(estimate).toBeDefined();
      expect(typeof estimate).toBe('number');
    });

    it('should handle very large time values', () => {
      const formatted = formatLoadingTime(3600000); // 1 hour
      expect(formatted).toBeDefined();
      expect(formatted).toContain('m');
    });

    it('should validate empty config', () => {
      const result = validateLoadingConfig({
        isLoading: false,
      });

      expect(result.valid).toBe(true);
    });

    it('should handle manager without announcer', () => {
      const manager = new LoadingManager();
      // Should not throw
      manager.setLoading('Test');
      manager.setProgress(50);
      manager.setSuccess('Done');
    });
  });
});
