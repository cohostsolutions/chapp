import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Organizations from '../Organizations';
import { AuthContext } from '@/hooks/authContext';
import type { AuthContextType } from '@/hooks/authContext';

const mockToast = vi.fn();
const mockNavigate = vi.fn();
const mockRpc = vi.fn();
const mockGetSession = vi.fn();
const mockProfilesUpdateEq = vi.fn();
const mockOrganizationsUpdateEq = vi.fn();
const mockFunctionsInvoke = vi.fn();

const organizationsSnapshot = [
  {
    id: 'org-1',
    name: 'Acme Resort',
    slug: 'acme-resort',
    created_at: '2026-04-01T00:00:00Z',
    ai_agent_type: 'jay',
    is_archived: false,
    member_count: 3,
    primary_count: 12,
  },
];

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/AddOrganizationDialog', () => ({
  AddOrganizationDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-organization-dialog">Dialog Open</div> : null,
}));

vi.mock('@/components/AddMemberDialog', () => ({
  AddMemberDialog: () => null,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    auth: {
      getSession: mockGetSession,
    },
    functions: {
      invoke: mockFunctionsInvoke,
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          update: vi.fn().mockReturnValue({
            eq: mockProfilesUpdateEq,
          }),
        };
      }

      if (table === 'organizations') {
        return {
          update: vi.fn().mockReturnValue({
            eq: mockOrganizationsUpdateEq,
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      };
    }),
  },
}));

describe('Organizations page', () => {
  const createMockAuthContext = (): AuthContextType => ({
    user: { id: 'user-1' } as AuthContextType['user'],
    session: null,
    profile: { id: 'user-1', email: 'admin@example.com', full_name: 'Admin', avatar_url: null, organization_id: null },
    roles: ['super_admin'],
    loading: false,
    aiAgentType: null,
    orgFeatures: null,
    refreshProfile: vi.fn().mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      full_name: 'Admin',
      avatar_url: null,
      organization_id: 'org-1',
    }),
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } }, error: null });
    mockRpc.mockResolvedValue({ data: organizationsSnapshot, error: null });
    mockProfilesUpdateEq.mockResolvedValue({ error: null });
    mockOrganizationsUpdateEq.mockResolvedValue({ error: null });
    mockFunctionsInvoke.mockResolvedValue({
      data: { summary: { leads_deleted: 1, bookings_deleted: 0, orders_deleted: 0 } },
      error: null,
    });
  });

  test('opens the add organization dialog from the header button', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={createMockAuthContext()}>
          <Organizations />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /add organization/i }));

    await waitFor(() => {
      expect(screen.getByTestId('add-organization-dialog')).toBeInTheDocument();
    });
  });

  test('archives an organization from the actions menu', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={createMockAuthContext()}>
          <Organizations />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /organization actions for acme resort/i }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /archive/i }));

    await waitFor(() => {
      expect(mockOrganizationsUpdateEq).toHaveBeenCalledWith('id', 'org-1');
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Organization archived',
      })
    );
  });

  test('switches organization view without reloading the page', async () => {
    const authContext = createMockAuthContext();

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authContext}>
          <Organizations />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /^view$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirm switch/i }));

    await waitFor(() => {
      expect(mockProfilesUpdateEq).toHaveBeenCalledWith('id', 'user-1');
      expect(authContext.refreshProfile).toHaveBeenCalled();
      expect(authContext.setImpersonatedRole).toHaveBeenCalledWith('client_admin');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('deletes an organization from the confirmation dialog', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={createMockAuthContext()}>
          <Organizations />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /organization actions for acme resort/i }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /^delete$/i }));

    await screen.findByText(/delete organization/i);
    fireEvent.click(screen.getByRole('button', { name: /delete organization/i }));

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('delete-organization', {
        body: { organizationId: 'org-1' },
      });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Organization deleted',
      })
    );
  });
});