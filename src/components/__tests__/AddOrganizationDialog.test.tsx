import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { AddOrganizationDialog } from '../AddOrganizationDialog';

const mockToast = vi.fn();
const mockOrganizationInsert = vi.fn();
const mockProfilesSafeSelect = vi.fn();
const mockProfilesUpdate = vi.fn();
const mockUserRolesUpsert = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'organizations') {
        return {
          insert: mockOrganizationInsert,
        };
      }

      if (table === 'profiles_safe') {
        return {
          select: mockProfilesSafeSelect,
        };
      }

      if (table === 'profiles') {
        return {
          update: mockProfilesUpdate,
        };
      }

      if (table === 'user_roles') {
        return {
          upsert: mockUserRolesUpsert,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  },
}));

describe('AddOrganizationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockOrganizationInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'org-1', name: 'Acme Resort' },
          error: null,
        }),
      }),
    });

    mockProfilesSafeSelect.mockReturnValue({
      is: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'user-1',
              email: 'jane@example.com',
              full_name: 'Jane Doe',
              organization_id: null,
            },
          ],
          error: null,
        }),
      }),
    });

    mockProfilesUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockUserRolesUpsert.mockResolvedValue({ error: null });
  });

  test('advances from organization step to member step when Next is clicked', async () => {
    render(
      <AddOrganizationDialog
        open
        onOpenChange={vi.fn()}
        onOrganizationAdded={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/organization name/i), {
      target: { value: 'Acme Resort' },
    });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(await screen.findByText(/adding members to:/i)).toBeInTheDocument();
    expect(screen.getByText(/select user/i)).toBeInTheDocument();
  });

  test('submits organization creation with feature access flags and optional member assignment', async () => {
    const onOpenChange = vi.fn();
    const onOrganizationAdded = vi.fn();

    render(
      <AddOrganizationDialog
        open
        onOpenChange={onOpenChange}
        onOrganizationAdded={onOrganizationAdded}
      />
    );

    fireEvent.change(screen.getByLabelText(/organization name/i), {
      target: { value: 'Acme Resort' },
    });

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    fireEvent.click(switches[2]);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    const userOption = await screen.findByRole('button', { name: /jane doe/i });
    fireEvent.click(userOption);

    fireEvent.click(screen.getByRole('button', { name: /create organization/i }));

    await waitFor(() => {
      expect(mockOrganizationInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Acme Resort',
          slug: 'acme-resort',
          workflows_enabled: true,
          training_enabled: true,
          social_feed_enabled: true,
          communications_enabled: false,
        })
      );
    });

    await waitFor(() => {
      expect(mockProfilesUpdate).toHaveBeenCalledWith({ organization_id: 'org-1' });
      expect(mockUserRolesUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          role: 'agent',
          sub_role: 'Sales',
        }),
        expect.objectContaining({
          onConflict: 'user_id,role',
        })
      );
    });

    expect(onOrganizationAdded).toHaveBeenCalledWith({ id: 'org-1', name: 'Acme Resort' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Organization Created',
      })
    );
  });

  test('reverts member assignment when role upsert fails after organization creation', async () => {
    mockUserRolesUpsert.mockResolvedValueOnce({
      error: { message: 'permission denied for table user_roles' },
    });

    render(
      <AddOrganizationDialog
        open
        onOpenChange={vi.fn()}
        onOrganizationAdded={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/organization name/i), {
      target: { value: 'Acme Resort' },
    });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('button', { name: /jane doe/i }));
    fireEvent.click(screen.getByRole('button', { name: /create organization/i }));

    await waitFor(() => {
      expect(mockProfilesUpdate).toHaveBeenNthCalledWith(1, { organization_id: 'org-1' });
      expect(mockProfilesUpdate).toHaveBeenNthCalledWith(2, { organization_id: null });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'Organization created, but member assignment failed and was reverted. Please try again.',
        variant: 'destructive',
      })
    );
  });
});