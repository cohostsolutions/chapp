import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthContext } from '@/hooks/authContext';
import type { AuthContextType } from '@/hooks/authContext';
import { useHelpdeskTickets } from '../useTeamChat';

const mockToast = vi.fn();
const mockHelpdeskListOrder = vi.fn();
const mockHelpdeskSelectSingle = vi.fn();
const mockHelpdeskInsertSingle = vi.fn();
const mockHelpdeskUpdateSelectSingle = vi.fn();
const mockTeamChatsInsertSingle = vi.fn();
const mockTeamChatsDeleteEq = vi.fn();
const mockTeamChatMembersInsert = vi.fn();
const mockTeamChatMembersUpsert = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockHelpdeskUpdate = vi.fn((payload: Record<string, unknown>) => ({
  eq: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: mockHelpdeskUpdateSelectSingle,
    }),
    payload,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'helpdesk_tickets') {
        return {
          select: vi.fn((columns: string) => {
            if (columns === '*') {
              return {
                order: mockHelpdeskListOrder,
              };
            }

            return {
              eq: vi.fn().mockReturnValue({
                single: mockHelpdeskSelectSingle,
              }),
            };
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: mockHelpdeskInsertSingle,
            }),
          }),
          update: mockHelpdeskUpdate,
        };
      }

      if (table === 'team_chats') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: mockTeamChatsInsertSingle,
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: mockTeamChatsDeleteEq,
          }),
        };
      }

      if (table === 'team_chat_members') {
        return {
          insert: mockTeamChatMembersInsert,
          upsert: mockTeamChatMembersUpsert,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  },
}));

describe('useHelpdeskTickets', () => {
  const createAuthContext = (): AuthContextType => ({
    user: { id: 'user-1' } as AuthContextType['user'],
    session: null,
    profile: {
      id: 'user-1',
      email: 'admin@example.com',
      full_name: 'Admin Example',
      avatar_url: null,
      organization_id: 'org-1',
    },
    roles: ['super_admin'],
    loading: false,
    aiAgentType: null,
    orgFeatures: null,
    refreshProfile: vi.fn(),
    signIn: vi.fn(),
    clearImpersonation: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    hasRole: vi.fn(() => true),
    isSuperAdmin: true,
    isClientAdmin: false,
    isAgent: false,
    checkLockout: vi.fn(),
    impersonatedRole: null,
    setImpersonatedRole: vi.fn(),
    effectiveRoles: ['super_admin'],
    effectiveIsSuperAdmin: true,
    effectiveIsClientAdmin: false,
    effectiveIsAgent: false,
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={createAuthContext()}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHelpdeskListOrder.mockResolvedValue({ data: [], error: null });
    mockHelpdeskSelectSingle.mockResolvedValue({
      data: {
        id: 'ticket-1',
        chat_id: 'chat-1',
        assigned_admin_id: null,
        assigned_at: null,
        assigned_by_admin_id: null,
        status: 'open'
      },
      error: null,
    });
    mockHelpdeskInsertSingle.mockResolvedValue({
      data: { id: 'ticket-1', chat_id: 'chat-1' },
      error: null,
    });
    mockHelpdeskUpdateSelectSingle.mockResolvedValue({
      data: { id: 'ticket-1', chat_id: 'chat-1', assigned_admin_id: 'admin-1', status: 'in_progress' },
      error: null,
    });
    mockTeamChatsInsertSingle.mockResolvedValue({ data: { id: 'chat-1' }, error: null });
    mockTeamChatsDeleteEq.mockResolvedValue({ error: null });
    mockTeamChatMembersInsert.mockResolvedValue({ error: null });
    mockTeamChatMembersUpsert.mockResolvedValue({ error: null });
  });

  test('rolls back helpdesk chat creation when requester membership insert fails', async () => {
    mockTeamChatMembersInsert.mockResolvedValueOnce({
      error: { message: 'permission denied for table team_chat_members' },
    });

    const { result } = renderHook(() => useHelpdeskTickets(), { wrapper });

    await expect(
      act(async () => {
        await result.current.createTicket.mutateAsync({ subject: 'Need help', priority: 'high' });
      })
    ).rejects.toEqual(expect.objectContaining({ message: 'permission denied for table team_chat_members' }));

    expect(mockTeamChatsDeleteEq).toHaveBeenCalledWith('id', 'chat-1');
    expect(mockHelpdeskInsertSingle).not.toHaveBeenCalled();
  });

  test('rolls back ticket assignment when adding the admin to the chat fails', async () => {
    mockTeamChatMembersUpsert.mockResolvedValueOnce({
      error: { message: 'duplicate key value violates unique constraint' },
    });

    const { result } = renderHook(() => useHelpdeskTickets(), { wrapper });

    await expect(
      act(async () => {
        await result.current.assignTicket.mutateAsync({ ticketId: 'ticket-1', adminId: 'admin-1' });
      })
    ).rejects.toEqual(expect.objectContaining({ message: 'duplicate key value violates unique constraint' }));

    expect(mockHelpdeskUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        assigned_admin_id: 'admin-1',
        assigned_by_admin_id: 'user-1',
        status: 'in_progress',
      })
    );
    expect(mockHelpdeskUpdate).toHaveBeenNthCalledWith(2, {
      assigned_admin_id: null,
      assigned_at: null,
      assigned_by_admin_id: null,
      status: 'open'
    });
  });

  test('records the resolving admin when a ticket is closed', async () => {
    const { result } = renderHook(() => useHelpdeskTickets(), { wrapper });

    await act(async () => {
      await result.current.resolveTicket.mutateAsync('ticket-1');
    });

    expect(mockHelpdeskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'resolved',
        resolved_by_admin_id: 'user-1',
      })
    );
  });
});