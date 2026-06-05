import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import Dashboard from '../Dashboard';
import { AuthContext } from '@/hooks/authContext';
import type { AuthContextType } from '@/hooks/authContext';

vi.mock('@/components/dashboard/AdminDashboard', () => ({
  default: () => <div>Admin Dashboard Mock</div>,
}));

vi.mock('@/components/dashboard/JayDashboard', () => ({
  default: () => <div>Jay Dashboard Mock</div>,
}));

vi.mock('@/components/dashboard/MayDashboard', () => ({
  default: () => <div>May Dashboard Mock</div>,
}));

vi.mock('@/components/dashboard/CeceDashboard', () => ({
  default: () => <div>Cece Dashboard Mock</div>,
}));

const createAuthContext = (overrides: Partial<AuthContextType> = {}): AuthContextType => ({
  user: { id: 'user-1' } as AuthContextType['user'],
  session: null,
  profile: {
    id: 'user-1',
    email: 'user@example.com',
    full_name: 'User Example',
    avatar_url: null,
    organization_id: 'org-1',
  },
  roles: ['agent'],
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
  isClientAdmin: false,
  isAgent: true,
  checkLockout: vi.fn(),
  impersonatedRole: null,
  setImpersonatedRole: vi.fn(),
  effectiveRoles: ['agent'],
  effectiveIsSuperAdmin: false,
  effectiveIsClientAdmin: false,
  effectiveIsAgent: true,
  ...overrides,
});

function renderDashboard(context: AuthContextType) {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={context}>
        <Dashboard />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('Dashboard route selection', () => {
  test('renders the admin dashboard for a non-impersonating super admin', () => {
    renderDashboard(createAuthContext({
      roles: ['super_admin'],
      aiAgentType: null,
      isSuperAdmin: true,
      isClientAdmin: false,
      isAgent: false,
      effectiveRoles: ['super_admin'],
      effectiveIsSuperAdmin: true,
      effectiveIsClientAdmin: false,
      effectiveIsAgent: false,
    }));

    expect(screen.getByText('Admin Dashboard Mock')).toBeInTheDocument();
  });

  test('renders the Jay dashboard for a Jay client admin', () => {
    renderDashboard(createAuthContext({
      roles: ['client_admin'],
      aiAgentType: 'jay',
      isSuperAdmin: false,
      isClientAdmin: true,
      isAgent: false,
      effectiveRoles: ['client_admin'],
      effectiveIsSuperAdmin: false,
      effectiveIsClientAdmin: true,
      effectiveIsAgent: false,
    }));

    expect(screen.getByText('Jay Dashboard Mock')).toBeInTheDocument();
  });

  test('renders the May dashboard for a May client admin', () => {
    renderDashboard(createAuthContext({
      roles: ['client_admin'],
      aiAgentType: 'may',
      isSuperAdmin: false,
      isClientAdmin: true,
      isAgent: false,
      effectiveRoles: ['client_admin'],
      effectiveIsSuperAdmin: false,
      effectiveIsClientAdmin: true,
      effectiveIsAgent: false,
    }));

    expect(screen.getByText('May Dashboard Mock')).toBeInTheDocument();
  });

  test('renders the Cece dashboard for a Cece agent', () => {
    renderDashboard(createAuthContext({
      roles: ['agent'],
      aiAgentType: 'cece',
      isSuperAdmin: false,
      isClientAdmin: false,
      isAgent: true,
      effectiveRoles: ['agent'],
      effectiveIsSuperAdmin: false,
      effectiveIsClientAdmin: false,
      effectiveIsAgent: true,
    }));

    expect(screen.getByText('Cece Dashboard Mock')).toBeInTheDocument();
  });
});