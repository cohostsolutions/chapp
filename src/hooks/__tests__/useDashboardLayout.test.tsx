import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthContext } from '@/hooks/authContext';
import type { AuthContextType } from '@/hooks/authContext';
import { useDashboardLayout } from '../useDashboardLayout';

const mockToast = vi.fn();
const mockMaybeSingle = vi.fn();
const mockDeleteEq = vi.fn();
const mockUpsert = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table !== 'dashboard_layouts') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockMaybeSingle,
              }),
            }),
          }),
        }),
        upsert: mockUpsert,
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: mockDeleteEq,
            }),
          }),
        }),
      };
    }),
  },
}));

describe('useDashboardLayout', () => {
  const createAuthContext = (): AuthContextType => ({
    user: { id: 'user-1' } as AuthContextType['user'],
    session: null,
    profile: {
      id: 'user-1',
      email: 'user@example.com',
      full_name: 'User Example',
      avatar_url: null,
      organization_id: 'org-1',
    },
    roles: ['client_admin'],
    loading: false,
    aiAgentType: 'jay',
    orgFeatures: { workflows_enabled: true, communications_enabled: true, social_feed_enabled: true },
    refreshProfile: vi.fn(),
    signIn: vi.fn(),
    clearImpersonation: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    hasRole: vi.fn(() => true),
    isSuperAdmin: false,
    isClientAdmin: true,
    isAgent: false,
    checkLockout: vi.fn(),
    impersonatedRole: null,
    setImpersonatedRole: vi.fn(),
    effectiveRoles: ['client_admin'],
    effectiveIsSuperAdmin: false,
    effectiveIsClientAdmin: true,
    effectiveIsAgent: false,
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={createAuthContext()}>{children}</AuthContext.Provider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ error: null });
    mockDeleteEq.mockResolvedValue({ error: null });
  });

  test('loads default widgets when no saved layout exists', async () => {
    const { result } = renderHook(
      () => useDashboardLayout('jay', ['stats', 'pipeline'], ['stats', 'pipeline', 'training'], { training_enabled: false }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.selectedWidgets).toEqual(['stats', 'pipeline']);
    expect(result.current.availableWidgets).toEqual(['stats', 'pipeline']);
  });

  test('saves sanitized widgets to dashboard_layouts', async () => {
    const { result } = renderHook(
      () => useDashboardLayout('jay', ['stats'], ['stats', 'pipeline', 'training'], { training_enabled: false }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.toggleWidget('pipeline');
      result.current.toggleWidget('training');
    });

    await act(async () => {
      await result.current.saveLayout();
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'user-1',
        dashboard_type: 'jay',
        layout: { selectedWidgets: ['stats', 'pipeline'] },
      }),
      expect.objectContaining({ onConflict: 'organization_id,user_id,dashboard_type' })
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Layout saved' })
    );
  });
});