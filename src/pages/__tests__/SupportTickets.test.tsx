import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import SupportTickets from '../SupportTickets';
import { AuthContext } from '@/hooks/authContext';
import type { AuthContextType } from '@/hooks/authContext';

const mockRpc = vi.fn();
const mockAssignMutateAsync = vi.fn();
const mockResolveMutateAsync = vi.fn();
const mockSendMessageMutateAsync = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    from: vi.fn(() => {
      throw new Error('SupportTickets should not read support queue tables directly');
    }),
  },
}));

vi.mock('@/hooks/useTeamChat', () => ({
  useHelpdeskTickets: () => ({
    tickets: [],
    isLoading: false,
    assignTicket: { mutateAsync: mockAssignMutateAsync },
    resolveTicket: { mutateAsync: mockResolveMutateAsync },
  }),
  useTeamChatMessages: () => ({
    messages: [],
    sendMessage: { mutateAsync: mockSendMessageMutateAsync, isPending: false },
    isLoading: false,
  }),
}));

describe('SupportTickets', () => {
  const createAuthContext = (): AuthContextType => ({
    user: { id: 'admin-1' } as AuthContextType['user'],
    session: null,
    profile: {
      id: 'admin-1',
      email: 'admin@example.com',
      full_name: 'Admin Example',
      avatar_url: null,
      organization_id: null,
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

  const renderPage = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthContext.Provider value={createAuthContext()}>
            <SupportTickets />
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssignMutateAsync.mockResolvedValue(undefined);
    mockResolveMutateAsync.mockResolvedValue(undefined);
    mockSendMessageMutateAsync.mockResolvedValue(undefined);
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'ticket-1',
          organization_id: 'org-1',
          organization_name: 'Canvas One',
          requester_id: 'requester-1',
          requester_name: 'Taylor Requester',
          requester_email: 'taylor@example.com',
          requester_avatar_url: null,
          subject: 'Payment not syncing',
          priority: 'urgent',
          status: 'open',
          chat_id: 'chat-1',
          assigned_admin_id: null,
          assigned_admin_name: null,
          assigned_admin_email: null,
          assigned_at: null,
          assigned_by_admin_id: null,
          assigned_by_name: null,
          created_at: '2026-04-03T10:00:00Z',
          updated_at: '2026-04-03T10:00:00Z',
          resolved_at: null,
          resolved_by_admin_id: null,
          resolved_by_name: null,
          last_message_at: '2026-04-03T10:05:00Z',
          last_message_preview: 'We need help with our payment feed.',
          last_message_sender_id: 'requester-1',
          last_message_sender_name: 'Taylor Requester',
          needs_admin_reply: true,
          waiting_on: 'admin',
        },
        {
          id: 'ticket-2',
          organization_id: 'org-2',
          organization_name: 'Canvas Two',
          requester_id: 'requester-2',
          requester_name: 'Jordan Customer',
          requester_email: 'jordan@example.com',
          requester_avatar_url: null,
          subject: 'Resolved onboarding issue',
          priority: 'low',
          status: 'resolved',
          chat_id: 'chat-2',
          assigned_admin_id: 'admin-2',
          assigned_admin_name: 'Other Admin',
          assigned_admin_email: 'other@example.com',
          assigned_at: '2026-04-02T10:00:00Z',
          assigned_by_admin_id: 'admin-2',
          assigned_by_name: 'Other Admin',
          created_at: '2026-04-02T09:00:00Z',
          updated_at: '2026-04-02T12:00:00Z',
          resolved_at: '2026-04-02T12:00:00Z',
          resolved_by_admin_id: 'admin-2',
          resolved_by_name: 'Other Admin',
          last_message_at: '2026-04-02T11:30:00Z',
          last_message_preview: 'Thanks, this is fixed.',
          last_message_sender_id: 'admin-2',
          last_message_sender_name: 'Other Admin',
          needs_admin_reply: false,
          waiting_on: 'resolved',
        },
      ],
      error: null,
    });
  });

  test('loads the support queue from the snapshot RPC', async () => {
    renderPage();

    expect(await screen.findByText('Payment not syncing')).toBeInTheDocument();
    expect(screen.getByText('Canvas One')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_support_tickets_snapshot');
    });
  });

  test('filters the queue and updates the selected ticket immediately after assignment', async () => {
    renderPage();

    await screen.findByText('Payment not syncing');
    fireEvent.click(screen.getByRole('button', { name: /needs reply/i }));

    expect(screen.getByText('Payment not syncing')).toBeInTheDocument();
    expect(screen.queryByText('Resolved onboarding issue')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /payment not syncing/i }));
    fireEvent.click(screen.getByRole('button', { name: /assign to me/i }));

    await waitFor(() => {
      expect(mockAssignMutateAsync).toHaveBeenCalledWith({ ticketId: 'ticket-1', adminId: 'admin-1' });
    });

    expect(await screen.findByText(/Assigned to: Admin Example/i)).toBeInTheDocument();
  });
});