import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import Settings from '../Settings';
import { AuthContext } from '@/hooks/authContext';
import type { AuthContextType } from '@/hooks/authContext';

const mockToast = vi.fn();
const mockRefreshProfile = vi.fn().mockResolvedValue(null);
const mockProfilesUpdate = vi.fn();
const mockProfilesUpdateEq = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageGetPublicUrl = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/useGoogleCalendar', () => ({
  useGoogleCalendar: () => ({
    checkConnection: vi.fn().mockResolvedValue(null),
    initiateOAuth: vi.fn(),
    exchangeCode: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(true),
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/components/settings/NotificationSettings', () => ({
  NotificationSettings: () => <div>Notification Settings</div>,
}));

vi.mock('@/components/settings/UserManagementTab', () => ({
  UserManagementTab: () => <div>User Management</div>,
}));

vi.mock('@/components/settings/SocialPlatformsTab', () => ({
  SocialPlatformsTab: () => <div>Social Platforms</div>,
}));

vi.mock('@/components/settings/AuditLogViewer', () => ({
  AuditLogViewer: () => <div>Audit Logs</div>,
}));

vi.mock('@/components/settings/SecretRotationTracker', () => ({
  SecretRotationTracker: () => <div>Secret Rotation</div>,
}));

vi.mock('@/components/settings/TwoFactorAuth', () => ({
  TwoFactorAuth: () => <div>Two Factor Auth</div>,
}));

vi.mock('@/components/settings/sessions/ActiveSessionsCard', () => ({
  ActiveSessionsCard: () => <div>Active Sessions</div>,
}));

vi.mock('@/components/AgentPriorityConfig', () => ({
  AgentPriorityConfig: () => <div>Agent Priority Config</div>,
}));

vi.mock('@/components/ThemeSwitcher', () => ({
  ThemeSwitcher: () => <div>Theme Switcher</div>,
}));

vi.mock('@/components/pwa/PWAInstallGuide', () => ({
  PWAInstallGuide: () => <div>PWA Install Guide</div>,
}));

vi.mock('@/components/onboarding/OnboardingTour', () => ({
  useOnboardingTour: () => ({ startTour: vi.fn() }),
  useResetTour: () => vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { name: 'Acme Resort', ai_agent_type: 'jay', twilio_enabled: true },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'phone_numbers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        };
      }

      if (table === 'profiles') {
        return {
          select: vi.fn((columns: string) => {
            if (columns.includes('created_at')) {
              return {
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { created_at: '2026-01-01T00:00:00Z', totp_enabled: false },
                    error: null,
                  }),
                }),
              };
            }

            throw new Error(`Unexpected profiles select: ${columns}`);
          }),
          update: mockProfilesUpdate,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    storage: {
      from: vi.fn(() => ({
        remove: mockStorageRemove,
        upload: mockStorageUpload,
        getPublicUrl: mockStorageGetPublicUrl,
      })),
    },
  },
}));

describe('Settings', () => {
  const createMockAuthContext = (): AuthContextType => ({
    user: { id: 'user-1' } as AuthContextType['user'],
    session: null,
    profile: {
      id: 'user-1',
      email: 'admin@example.com',
      full_name: 'Alice Example',
      avatar_url: null,
      organization_id: 'org-1',
    },
    roles: ['client_admin'],
    loading: false,
    aiAgentType: 'jay',
    orgFeatures: { workflows_enabled: true, communications_enabled: true, social_feed_enabled: true },
    refreshProfile: mockRefreshProfile,
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockProfilesUpdateEq.mockResolvedValue({ error: null });
    mockProfilesUpdate.mockReturnValue({ eq: mockProfilesUpdateEq });
    mockStorageRemove.mockResolvedValue({ error: null });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageGetPublicUrl.mockReturnValue({
      data: {
        publicUrl: 'https://example.com/storage/v1/object/public/avatars/user-1/1700000000000.png',
      },
    });
  });

  test('saves a trimmed full name and refreshes the profile', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={createMockAuthContext()}>
          <Settings />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    const fullNameInput = await screen.findByLabelText(/full name/i);
    fireEvent.change(fullNameInput, { target: { value: '  Jane Admin  ' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockProfilesUpdate).toHaveBeenCalledWith({ full_name: 'Jane Admin' });
    });

    expect(mockProfilesUpdateEq).toHaveBeenCalledWith('id', 'user-1');
    expect(mockRefreshProfile).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Profile Updated' })
    );
  });

  test('uploads a profile photo and refreshes the profile', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const { container } = render(
      <MemoryRouter>
        <AuthContext.Provider value={createMockAuthContext()}>
          <Settings />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    const fileInput = container.querySelector('#avatar-upload') as HTMLInputElement;
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockStorageUpload).toHaveBeenCalledWith(
        'user-1/1700000000000.png',
        file,
        expect.objectContaining({ cacheControl: '3600', upsert: false })
      );
    });

    expect(mockProfilesUpdate).toHaveBeenCalledWith({
      avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/1700000000000.png',
    });
    expect(mockRefreshProfile).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Photo updated' })
    );
  });

  test('opens the integrations tab from the tab query parameter', async () => {
    render(
      <MemoryRouter initialEntries={['/settings?tab=integrations']}>
        <AuthContext.Provider value={createMockAuthContext()}>
          <Settings />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Social Platforms')).toBeInTheDocument();
  });
});