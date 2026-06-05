import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TimeoutError,
  MaxRetriesExceededError,
  createTimeoutPromise,
  withTimeout,
  calculateBackoffDelay,
  isRetryableError,
  executeWithRetry,
  TimeoutPreset,
  getPresetConfig,
  TimeoutManager,
  raceWithTimeout,
  allWithTimeout,
  validateTimeoutConfig,
  DEFAULT_TIMEOUT,
  DEFAULT_RETRIES,
  DEFAULT_BACKOFF_MULTIPLIER,
  DEFAULT_INITIAL_BACKOFF,
  DEFAULT_MAX_BACKOFF,
  DEFAULT_RETRYABLE_STATUS_CODES,
  type TimeoutConfig,
} from '../lib/timeoutHandling';

describe('Timeout Handling Utilities', () => {
  describe('TimeoutError', () => {
    it('should create timeout error with message', () => {
      const error = new TimeoutError('Custom timeout');
      expect(error.message).toBe('Custom timeout');
      expect(error.name).toBe('TimeoutError');
    });

    it('should store timeout duration', () => {
      const error = new TimeoutError('Timeout', 5000);
      expect(error.timeoutMs).toBe(5000);
    });

    it('should store attempt number', () => {
      const error = new TimeoutError('Timeout', 5000, 2);
      expect(error.attempt).toBe(2);
    });

    it('should use default message', () => {
      const error = new TimeoutError();
      expect(error.message).toBe('Request timeout');
    });
  });

  describe('MaxRetriesExceededError', () => {
    it('should create max retries error', () => {
      const error = new MaxRetriesExceededError('Max retries', 5);
      expect(error.message).toBe('Max retries');
      expect(error.totalAttempts).toBe(5);
      expect(error.name).toBe('MaxRetriesExceededError');
    });

    it('should use default message', () => {
      const error = new MaxRetriesExceededError();
      expect(error.message).toBe('Maximum retries exceeded');
    });
  });

  describe('createTimeoutPromise', () => {
    it('should reject after specified timeout', async () => {
      const promise = createTimeoutPromise(100);
      await expect(promise).rejects.toThrow(TimeoutError);
    });

    it('should use custom message', async () => {
      const promise = createTimeoutPromise(100, 'Custom message');
      await expect(promise).rejects.toThrow('Custom message');
    });

    it('should record timeout duration', async () => {
      const promise = createTimeoutPromise<number>(100);
      try {
        await promise;
      } catch (error) {
        expect((error as TimeoutError).timeoutMs).toBe(100);
      }
    });

    it('should not resolve before timeout', async () => {
      const promise = createTimeoutPromise(1000);
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve('timeout'), 100)
      );

      const result = await Promise.race([promise, timeoutPromise]);
      expect(result).toBe('timeout');
    });
  });

  describe('withTimeout', () => {
    it('should resolve if promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000);
      expect(result).toBe('success');
    });

    it('should reject if promise exceeds timeout', async () => {
      const promise = new Promise((resolve) =>
        setTimeout(() => resolve('slow'), 1000)
      );
      await expect(withTimeout(promise, 100)).rejects.toThrow(TimeoutError);
    });

    it('should reject with custom message', async () => {
      const promise = new Promise(() => {
        // Never resolves
      });
      await expect(
        withTimeout(promise, 100, 'Custom timeout message')
      ).rejects.toThrow('Custom timeout message');
    });

    it('should handle rejection from promise', async () => {
      const promise = Promise.reject(new Error('Promise error'));
      await expect(withTimeout(promise, 1000)).rejects.toThrow('Promise error');
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff', () => {
      const delay1 = calculateBackoffDelay(1, {
        initialBackoff: 1000,
        backoffMultiplier: 2,
      });
      const delay2 = calculateBackoffDelay(2, {
        initialBackoff: 1000,
        backoffMultiplier: 2,
      });

      expect(delay2).toBeGreaterThan(delay1);
    });

    it('should respect max backoff', () => {
      const delay = calculateBackoffDelay(10, {
        initialBackoff: 1000,
        backoffMultiplier: 2,
        maxBackoff: 5000,
      });

      expect(delay).toBeLessThanOrEqual(5000);
    });

    it('should add jitter to backoff', () => {
      const delays = [
        calculateBackoffDelay(1, { initialBackoff: 1000 }),
        calculateBackoffDelay(1, { initialBackoff: 1000 }),
        calculateBackoffDelay(1, { initialBackoff: 1000 }),
      ];

      // With jitter, delays should not all be identical
      const unique = new Set(delays);
      expect(unique.size).toBeGreaterThanOrEqual(2);
    });

    it('should use default multiplier', () => {
      const delay1 = calculateBackoffDelay(1);
      const delay2 = calculateBackoffDelay(2);

      expect(delay2).toBeGreaterThan(delay1);
    });

    it('should handle first attempt', () => {
      const delay = calculateBackoffDelay(1, { initialBackoff: 1000 });
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(1100); // With jitter
    });

    it('should increase exponentially', () => {
      const delay1 = calculateBackoffDelay(1, {
        initialBackoff: 1000,
        backoffMultiplier: 1.5,
      });
      const delay2 = calculateBackoffDelay(2, {
        initialBackoff: 1000,
        backoffMultiplier: 1.5,
      });
      const delay3 = calculateBackoffDelay(3, {
        initialBackoff: 1000,
        backoffMultiplier: 1.5,
      });

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });
  });

  describe('isRetryableError', () => {
    it('should retry on TimeoutError', () => {
      const error = new TimeoutError('Timeout');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should retry on retryable status codes', () => {
      const error = { status: 503 }; // Service Unavailable
      expect(isRetryableError(error)).toBe(true);
    });

    it('should retry on 429 Too Many Requests', () => {
      const error = { status: 429 };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should retry on network errors', () => {
      const error = new Error('network error');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should not retry on non-retryable status codes', () => {
      const error = { status: 400 }; // Bad Request
      expect(isRetryableError(error)).toBe(false);
    });

    it('should not retry on 401 Unauthorized', () => {
      const error = { status: 401 };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should respect custom retryable codes', () => {
      const error = { status: 400 };
      expect(isRetryableError(error, { retryableStatusCodes: [400] })).toBe(
        true
      );
    });

    it('should retry on offline error', () => {
      const error = new Error('offline');
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await executeWithRetry(fn, { retries: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TimeoutError('Timeout'))
        .mockResolvedValueOnce('success');

      const result = await executeWithRetry(fn, { retries: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries exceeded', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new TimeoutError('Timeout'));

      await expect(
        executeWithRetry(fn, { retries: 2 })
      ).rejects.toThrow(TimeoutError);

      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TimeoutError('Timeout'))
        .mockResolvedValueOnce('success');

      await executeWithRetry(fn, { retries: 3, onRetry });

      expect(onRetry).toHaveBeenCalled();
    });

    it('should call onTimeout callback', async () => {
      const onTimeout = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TimeoutError('Timeout'))
        .mockResolvedValueOnce('success');

      await executeWithRetry(fn, { retries: 3, onTimeout });

      expect(onTimeout).toHaveBeenCalled();
    });

    it('should call onFailure on final failure', async () => {
      const onFailure = vi.fn();
      const error = new TimeoutError('Timeout');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        executeWithRetry(fn, { retries: 0, onFailure })
      ).rejects.toThrow();

      expect(onFailure).toHaveBeenCalledWith(error);
    });

    it('should respect autoRetry flag', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TimeoutError('Timeout'));

      await expect(
        executeWithRetry(fn, { retries: 3, autoRetry: false })
      ).rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should increase timeout for each attempt', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TimeoutError('Timeout', 1000))
        .mockResolvedValueOnce('success');

      await executeWithRetry(fn, { timeout: 1000, retries: 1 });

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('TimeoutPreset', () => {
    it('should define preset timeouts', () => {
      expect(TimeoutPreset.INSTANT).toBe(5000);
      expect(TimeoutPreset.FAST).toBe(10000);
      expect(TimeoutPreset.NORMAL).toBe(30000);
      expect(TimeoutPreset.SLOW).toBe(60000);
      expect(TimeoutPreset.VERY_SLOW).toBe(120000);
    });
  });

  describe('getPresetConfig', () => {
    it('should return config for INSTANT preset', () => {
      const config = getPresetConfig(TimeoutPreset.INSTANT);
      expect(config.timeout).toBe(5000);
      expect(config.retries).toBeGreaterThanOrEqual(3);
    });

    it('should return config for NORMAL preset', () => {
      const config = getPresetConfig(TimeoutPreset.NORMAL);
      expect(config.timeout).toBe(30000);
    });

    it('should cap maxTimeout', () => {
      const config = getPresetConfig(TimeoutPreset.VERY_SLOW);
      expect(config.maxTimeout).toBeLessThanOrEqual(300000);
    });
  });

  describe('TimeoutManager', () => {
    it('should create with default config', () => {
      const manager = new TimeoutManager();
      expect(manager).toBeDefined();
    });

    it('should start and track elapsed time', () => {
      const manager = new TimeoutManager({ timeout: 10000 });
      manager.start();

      setTimeout(() => {
        const elapsed = manager.getElapsed();
        expect(elapsed).toBeGreaterThanOrEqual(100);
      }, 100);
    });

    it('should calculate remaining time', () => {
      const manager = new TimeoutManager({ timeout: 5000 });
      manager.start();

      const remaining = manager.getRemaining();
      expect(remaining).toBeLessThanOrEqual(5000);
      expect(remaining).toBeGreaterThan(0);
    });

    it('should detect timeout exceeded', async () => {
      const manager = new TimeoutManager({ timeout: 100 });
      manager.start();

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(manager.isExceeded()).toBe(true);
    });

    it('should clear timeout', () => {
      const manager = new TimeoutManager({ timeout: 5000 });
      manager.start();
      manager.clear();

      const elapsed = manager.getElapsed();
      expect(elapsed).toBe(0);
    });

    it('should reset timeout', () => {
      const manager = new TimeoutManager({ timeout: 5000 });
      manager.start();

      setTimeout(() => {
        manager.reset();
        const remaining = manager.getRemaining();
        expect(remaining).toBeGreaterThan(4000);
      }, 100);
    });

    it('should extend timeout', () => {
      const manager = new TimeoutManager({ timeout: 5000 });
      manager.start();

      const before = manager.getRemaining();
      manager.extend(2000);
      const after = manager.getRemaining();

      expect(after).toBeGreaterThan(before);
    });

    it('should format remaining time', () => {
      const manager = new TimeoutManager({ timeout: 30000 });
      manager.start();

      const formatted = manager.getFormattedRemaining();
      expect(formatted).toMatch(/^\d+[sm]$/);
    });

    it('should update config', () => {
      const manager = new TimeoutManager({ timeout: 5000 });
      manager.updateConfig({ timeout: 10000 });

      expect(manager.getRemaining()).toBeLessThanOrEqual(10000);
    });
  });

  describe('raceWithTimeout', () => {
    it('should resolve with first resolved promise', async () => {
      const promises = [
        new Promise((resolve) => setTimeout(() => resolve('first'), 100)),
        new Promise((resolve) => setTimeout(() => resolve('second'), 200)),
      ];

      const result = await raceWithTimeout(promises, 1000);
      expect(result).toBe('first');
    });

    it('should timeout if all promises take too long', async () => {
      const promises = [
        new Promise((resolve) => setTimeout(() => resolve('first'), 2000)),
        new Promise((resolve) => setTimeout(() => resolve('second'), 3000)),
      ];

      await expect(raceWithTimeout(promises, 100)).rejects.toThrow(
        TimeoutError
      );
    });

    it('should use custom timeout message', async () => {
      const promises = [
        new Promise(() => {
          /* Never resolves */
        }),
      ];

      await expect(
        raceWithTimeout(promises, 100, 'Custom race timeout')
      ).rejects.toThrow('Custom race timeout');
    });
  });

  describe('allWithTimeout', () => {
    it('should resolve when all promises complete', async () => {
      const promises = [
        Promise.resolve(1),
        Promise.resolve(2),
        Promise.resolve(3),
      ];

      const results = await allWithTimeout(promises, 1000);
      expect(results).toEqual([1, 2, 3]);
    });

    it('should timeout if any promise takes too long', async () => {
      const promises = [
        Promise.resolve(1),
        new Promise((resolve) => setTimeout(() => resolve(2), 2000)),
      ];

      await expect(allWithTimeout(promises, 100)).rejects.toThrow(
        TimeoutError
      );
    });
  });

  describe('validateTimeoutConfig', () => {
    it('should validate correct config', () => {
      const result = validateTimeoutConfig({
        timeout: 5000,
        retries: 3,
        backoffMultiplier: 1.5,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative timeout', () => {
      const result = validateTimeoutConfig({ timeout: -1000 });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject negative retries', () => {
      const result = validateTimeoutConfig({ retries: -1 });
      expect(result.valid).toBe(false);
    });

    it('should reject backoff multiplier <= 1', () => {
      const result = validateTimeoutConfig({ backoffMultiplier: 1 });
      expect(result.valid).toBe(false);
    });

    it('should reject timeout > maxTimeout', () => {
      const result = validateTimeoutConfig({
        timeout: 10000,
        maxTimeout: 5000,
      });

      expect(result.valid).toBe(false);
    });

    it('should reject initialBackoff > maxBackoff', () => {
      const result = validateTimeoutConfig({
        initialBackoff: 10000,
        maxBackoff: 5000,
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should define default timeout', () => {
      expect(DEFAULT_TIMEOUT).toBe(30000);
    });

    it('should define default retries', () => {
      expect(DEFAULT_RETRIES).toBe(3);
    });

    it('should define retryable status codes', () => {
      expect(DEFAULT_RETRYABLE_STATUS_CODES).toContain(503);
      expect(DEFAULT_RETRYABLE_STATUS_CODES).toContain(429);
      expect(DEFAULT_RETRYABLE_STATUS_CODES).toContain(504);
    });

    it('should have reasonable defaults', () => {
      expect(DEFAULT_TIMEOUT).toBeGreaterThan(0);
      expect(DEFAULT_RETRIES).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_INITIAL_BACKOFF).toBeGreaterThan(0);
      expect(DEFAULT_BACKOFF_MULTIPLIER).toBeGreaterThan(1);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle network request retry', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) {
          throw new TimeoutError('Network timeout');
        }
        return { data: 'success' };
      };

      const result = await executeWithRetry(fn, {
        timeout: 5000,
        retries: 3,
      });

      expect(result.data).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should fail after max retries with status code', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        const error = new Error('Service unavailable');
        (error as any).status = 503;
        throw error;
      };

      await expect(
        executeWithRetry(fn, { retries: 2 })
      ).rejects.toThrow();

      expect(attempts).toBe(3); // 1 initial + 2 retries
    });

    it('should handle timeout manager for long operations', () => {
      const manager = new TimeoutManager({ timeout: 60000 });
      manager.start();

      expect(manager.isExceeded()).toBe(false);

      // Simulate progress
      const remaining = manager.getRemaining();
      expect(remaining).toBeGreaterThan(50000);

      manager.clear();
    });
  });
});
