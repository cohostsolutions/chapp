import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AssetMigration from '../AssetMigration';
import { AuthContext } from '@/hooks/authContext';
import type { AuthContextType } from '@/hooks/authContext';

const mockToast = vi.fn();
const mockOrganizationsSelect = vi.fn();
const mockRpc = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: any) => <div>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    functions: {
      invoke: mockInvoke,
    },
    from: vi.fn((table: string) => {
      if (table === 'organizations') {
        return {
          select: mockOrganizationsSelect,
        };
      }

      throw new Error(`Unexpected table access: ${table}`);
    }),
  },
}));

describe('AssetMigration', () => {
  const createAuthContext = (): AuthContextType => ({
    user: { id: 'user-1' } as AuthContextType['user'],
    session: null,
    profile: { id: 'user-1', email: 'admin@example.com', full_name: 'Admin', avatar_url: null, organization_id: null },
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

  beforeEach(() => {
    vi.clearAllMocks();

    mockOrganizationsSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { id: 'org-1', name: 'Source Org', slug: 'source-org' },
            { id: 'org-2', name: 'Target Org', slug: 'target-org' },
          ],
          error: null,
        }),
      }),
    });

    mockRpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_asset_migration_preview') {
        return {
          data: {
            categories: [
              {
                key: 'leads',
                label: 'Leads',
                totalCount: 999,
                items: [{ id: 'lead-1', name: 'Jane Doe', subtitle: 'jane@example.com', status: 'new' }],
              },
              {
                key: 'bookings',
                label: 'Bookings',
                relatedTo: 'leads',
                totalCount: 1,
                items: [{ id: 'booking-1', name: 'Booking 12345678', subtitle: '2026-01-01 - 2026-01-02', status: 'confirmed' }],
              },
            ],
          },
          error: null,
        };
      }

      if (fn === 'validate_asset_migration_plan') {
        return {
          data: { warnings: [] },
          error: null,
        };
      }

      throw new Error(`Unexpected RPC: ${fn}`);
    });

    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  test('loads preview from the server-side RPC and renders truncation info', async () => {
    render(
      <MemoryRouter initialEntries={['/asset-migration?from=org-1&to=org-2']}>
        <AuthContext.Provider value={createAuthContext()}>
          <AssetMigration />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await screen.findByText('Asset Migration');

    fireEvent.click(screen.getByRole('button', { name: /preview migration/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_asset_migration_preview', {
        p_source_org_id: 'org-1',
        p_preview_limit: 500,
      });
    });

    expect(await screen.findByText(/Leads \(999\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Previewing 1 of 999/i)).toBeInTheDocument();
    expect(screen.getByText(/1000 assets selected/i)).toBeInTheDocument();
  });

  test('blocks migration when dependent categories are selected without their parent records', async () => {
    render(
      <MemoryRouter initialEntries={['/asset-migration?from=org-1&to=org-2']}>
        <AuthContext.Provider value={createAuthContext()}>
          <AssetMigration />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await screen.findByText('Asset Migration');
    fireEvent.click(screen.getByRole('button', { name: /preview migration/i }));
    await screen.findByText(/1000 assets selected/i);

    fireEvent.click(screen.getByRole('checkbox', { name: /select all leads/i }));
    fireEvent.click(screen.getByRole('button', { name: /migrate assets/i }));

    expect(await screen.findByText(/migration blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/orphaned records with broken references/i)).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test('executes migration with full-category mode for truncated selections', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        results: {
          leads: 999,
          bookings: 1,
        },
        migrationLog: {
          id: 'migration-1',
          source_organization_id: 'org-1',
          target_organization_id: 'org-2',
          migrated_leads: ['lead-1'],
          migrated_platforms: [],
          migrated_bookings: ['booking-1'],
          migrated_orders: [],
          migrated_offerings: [],
          migrated_room_units: [],
          migrated_knowledge_entries: [],
          migrated_knowledge_docs: [],
          migrated_reports: [],
          migrated_workflows: [],
          migrated_calendar_events: [],
          migrated_communications: [],
          migrated_message_templates: [],
          migrated_training_modules: [],
          migrated_team_chats: [],
          migrated_ai_conversations: [],
          migrated_agent_priorities: [],
          migrated_rubric_templates: [],
          performed_at: '2026-04-03T20:00:00Z',
          can_undo_until: '2099-04-03T20:01:00Z',
          is_undone: false,
        },
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/asset-migration?from=org-1&to=org-2']}>
        <AuthContext.Provider value={createAuthContext()}>
          <AssetMigration />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await screen.findByText('Asset Migration');
    fireEvent.click(screen.getByRole('button', { name: /preview migration/i }));
    await screen.findByText(/1000 assets selected/i);

    fireEvent.click(screen.getByRole('button', { name: /migrate assets/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('validate_asset_migration_plan', {
        p_source_org_id: 'org-1',
        p_assets: {
          leads: { mode: 'all' },
          bookings: { mode: 'all' },
        },
      });
    });

    fireEvent.click(await screen.findByRole('button', { name: /confirm migration/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('migrate-assets', {
        body: {
          sourceOrgId: 'org-1',
          targetOrgId: 'org-2',
          assets: {
            leads: { mode: 'all' },
            bookings: { mode: 'all' },
          },
        },
      });
    });

    expect(await screen.findByText(/migration complete!/i)).toBeInTheDocument();
    expect(screen.getByText(/Leads: 999 migrated/i)).toBeInTheDocument();
    expect(screen.getByText(/Bookings: 1 migrated/i)).toBeInTheDocument();
  });

  test('undoes the most recent migration from the undo banner', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        data: {
          success: true,
          results: {
            leads: 999,
            bookings: 1,
          },
          migrationLog: {
            id: 'migration-undo',
            source_organization_id: 'org-1',
            target_organization_id: 'org-2',
            migrated_leads: ['lead-1'],
            migrated_platforms: [],
            migrated_bookings: ['booking-1'],
            migrated_orders: [],
            migrated_offerings: [],
            migrated_room_units: [],
            migrated_knowledge_entries: [],
            migrated_knowledge_docs: [],
            migrated_reports: [],
            migrated_workflows: [],
            migrated_calendar_events: [],
            migrated_communications: [],
            migrated_message_templates: [],
            migrated_training_modules: [],
            migrated_team_chats: [],
            migrated_ai_conversations: [],
            migrated_agent_priorities: [],
            migrated_rubric_templates: [],
            performed_at: '2026-04-03T20:00:00Z',
            can_undo_until: '2099-04-03T20:01:00Z',
            is_undone: false,
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { success: true }, error: null });

    render(
      <MemoryRouter initialEntries={['/asset-migration?from=org-1&to=org-2']}>
        <AuthContext.Provider value={createAuthContext()}>
          <AssetMigration />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await screen.findByText('Asset Migration');
    fireEvent.click(screen.getByRole('button', { name: /preview migration/i }));
    await screen.findByText(/1000 assets selected/i);

    fireEvent.click(screen.getByRole('button', { name: /migrate assets/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirm migration/i }));

    fireEvent.click(await screen.findByRole('button', { name: /undo migration/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('undo-migration', {
        body: { migrationId: 'migration-undo' },
      });
    });
  });

  test('blocks migration when server validation finds missing lead dependencies', async () => {
    mockRpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_asset_migration_preview') {
        return {
          data: {
            categories: [
              {
                key: 'leads',
                label: 'Leads',
                totalCount: 2,
                items: [
                  { id: 'lead-1', name: 'Jane Doe', subtitle: 'jane@example.com', status: 'new' },
                  { id: 'lead-2', name: 'John Doe', subtitle: 'john@example.com', status: 'new' },
                ],
              },
              {
                key: 'bookings',
                label: 'Bookings',
                relatedTo: 'leads',
                totalCount: 1,
                items: [{ id: 'booking-1', name: 'Booking 12345678', subtitle: '2026-01-01 - 2026-01-02', status: 'confirmed' }],
              },
            ],
          },
          error: null,
        };
      }

      if (fn === 'validate_asset_migration_plan') {
        return {
          data: {
            warnings: [
              {
                category: 'Bookings',
                issue: '1 selected booking(s) reference leads that are not included in this migration.',
                severity: 'error',
              },
            ],
          },
          error: null,
        };
      }

      throw new Error(`Unexpected RPC: ${fn}`);
    });

    render(
      <MemoryRouter initialEntries={['/asset-migration?from=org-1&to=org-2']}>
        <AuthContext.Provider value={createAuthContext()}>
          <AssetMigration />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await screen.findByText('Asset Migration');
    fireEvent.click(screen.getByRole('button', { name: /preview migration/i }));
    await screen.findByText(/3 assets selected/i);

    fireEvent.click(screen.getByRole('checkbox', { name: /select john doe in leads/i }));
    fireEvent.click(screen.getByRole('button', { name: /migrate assets/i }));

    expect(await screen.findByText(/migration blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/1 selected booking\(s\) reference leads that are not included in this migration/i)).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});