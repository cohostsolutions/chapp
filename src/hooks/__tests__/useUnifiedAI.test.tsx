import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useUnifiedAI } from '@/hooks/useUnifiedAI';

const toastMock = vi.fn();
const invokeMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/lib/logger', () => ({
  devLog: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

describe('useUnifiedAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('uses latest conversationId on subsequent sends', async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: {
          response: 'First response',
          conversationId: 'conv-1',
          ai_agent_type: 'jay',
          ai_agent_name: 'Jay',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          response: 'Second response',
          conversationId: 'conv-1',
          ai_agent_type: 'jay',
          ai_agent_name: 'Jay',
        },
        error: null,
      });

    const { result } = renderHook(() => useUnifiedAI({ organizationId: 'org-1' }));

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    await act(async () => {
      await result.current.sendMessage('follow up');
    });

    const secondCallBody = invokeMock.mock.calls[1][1].body;
    expect(secondCallBody.conversationId).toBe('conv-1');
  });

  test('keeps message history continuity across sequential sends', async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: {
          response: 'First response',
          conversationId: 'conv-1',
          ai_agent_type: 'jay',
          ai_agent_name: 'Jay',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          response: 'Second response',
          conversationId: 'conv-1',
          ai_agent_type: 'jay',
          ai_agent_name: 'Jay',
        },
        error: null,
      });

    const { result } = renderHook(() => useUnifiedAI({ organizationId: 'org-1' }));

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    await act(async () => {
      await result.current.sendMessage('follow up');
    });

    const secondCallHistory = invokeMock.mock.calls[1][1].body.conversationHistory as Array<{ role: string; content: string }>;
    const historyTexts = secondCallHistory.map((entry) => `${entry.role}:${entry.content}`);

    expect(historyTexts).toContain('user:hello');
    expect(historyTexts).toContain('assistant:First response');
    expect(historyTexts).toContain('user:follow up');
  });
});
