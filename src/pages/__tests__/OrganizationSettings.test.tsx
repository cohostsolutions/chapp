import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import OrganizationSettings from '../OrganizationSettings';
import { AuthContext } from '@/hooks/authContext';
import type { AuthContextType } from '@/hooks/authContext';

const mockToast = vi.fn();
const mockOrganizationsUpdateEq = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'org-1',
                  name: 'Acme Resort',
                  slug: 'acme-resort',
                  agent_assignment_method: 'round_robin',
                  agent_shared_access: true,
                  workflows_enabled: false,
                  training_enabled: false,
                  social_feed_enabled: false,
                  training_pii_redaction: false,
                  training_retention_days: null,
                  default_country_code: '+63',
                  timezone: 'Asia/Manila',
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: mockOrganizationsUpdateEq,
          }),
        };
      }

      if (table === 'profiles_safe') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }

      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  },
}));

describe('OrganizationSettings', () => {
  const createMockAuthContext = (): AuthContextType => ({
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
    mockOrganizationsUpdateEq.mockResolvedValue({ error: null });
  });

  test('saves feature access changes from the organization settings page', async () => {
    render(
      <MemoryRouter initialEntries={['/organizations/org-1/settings']}>
        <AuthContext.Provider value={createMockAuthContext()}>
          <Routes>
            <Route path="/organizations/:id/settings" element={<OrganizationSettings />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    const switches = await screen.findAllByRole('switch');
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    fireEvent.click(switches[2]);

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockOrganizationsUpdateEq).toHaveBeenCalledWith('id', 'org-1');
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Settings Saved',
      })
    );
  });
});