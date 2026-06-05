import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import SecurityDashboard from '../SecurityDashboard';
import { AuthContext } from '@/hooks/authContext';
import type { AuthContextType } from '@/hooks/authContext';

const mockToast = vi.fn();
const mockNavigate = vi.fn();
const mockRpc = vi.fn();

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

vi.mock('@/components/security/IPBlocklistManager', () => ({
  IPBlocklistManager: () => <div>IP Blocklist Mock</div>,
}));

vi.mock('@/components/security/LoginMonitoringDashboard', () => ({
  LoginMonitoringDashboard: () => <div>Login Monitoring Mock</div>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    from: vi.fn((table: string) => {
      throw new Error(`SecurityDashboard should not query ${table} directly`);
    }),
  },
}));

describe('SecurityDashboard', () => {
  const createAuthContext = (): AuthContextType => ({
    user: { id: 'user-1' } as AuthContextType['user'],
    session: null,
    profile: {
      id: 'user-1',
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: {
        metrics: {
          totalAuditLogs: 42,
          failedLogins24h: 3,
          successfulLogins24h: 11,
          overdueSecrets: 2,
          recentUserActions: 7,
        },
        auditLogs: [
          {
            id: 'log-1',
            created_at: '2026-04-04T10:00:00Z',
            action: 'user_updated',
            resource_type: 'profile',
            resource_id: 'resource-1',
            ip_address: '127.0.0.1',
            details: {},
          },
        ],
        loginAttempts: [
          {
            id: 'attempt-1',
            attempted_at: '2026-04-04T09:00:00Z',
            was_successful: false,
            email: 'target@example.com',
            ip_address: '127.0.0.1',
            country: 'United States',
            country_code: 'US',
            city: 'Austin',
            region: 'TX',
            latitude: 30.2672,
            longitude: -97.7431,
            isp: 'Test ISP',
          },
        ],
        secretRotations: [
          {
            id: 'secret-1',
            secret_name: 'Stripe API Key',
            last_rotated_at: '2026-04-01T00:00:00Z',
            rotation_interval_days: 30,
          },
        ],
      },
      error: null,
    });
  });

  test('loads the dashboard from the security snapshot RPC', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={createAuthContext()}>
          <SecurityDashboard />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Security Dashboard')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_security_dashboard_snapshot');
    });
  });
});