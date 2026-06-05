import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AITestChat } from '../landing/AITestChat';

const mockInvoke = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
const mockTrackEvent = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    info: mockToastInfo,
  },
}));

vi.mock('@/hooks/useAnalyticsTracking', () => ({
  trackEvent: mockTrackEvent,
}));

describe('AITestChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  test('blocks sends while offline', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    render(<AITestChat onGetStarted={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
      target: { value: 'Hello there' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(mockToastError).toHaveBeenCalledWith('Demo requires internet connection. Please check your connection.');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test('shows a specific toast and no retry message for rate limits', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('rate limit exceeded'));

    render(<AITestChat onGetStarted={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
      target: { value: 'Tell me about pricing' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Too many requests. Please wait a moment before trying again.');
    });

    expect(screen.queryByText(/you can try again now/i)).not.toBeInTheDocument();
  });

  test('shows retry guidance for retryable demo failures', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('fetch failed'));

    render(<AITestChat onGetStarted={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
      target: { value: 'Do you have rooms available?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Network error. Please check your connection.');
    });

    expect(await screen.findByText(/you can try again now/i)).toBeInTheDocument();
    expect(screen.queryByText('Do you have rooms available?')).not.toBeInTheDocument();
  });
});