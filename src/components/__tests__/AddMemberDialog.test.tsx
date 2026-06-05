import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { AddMemberDialog } from '../AddMemberDialog';

const mockToast = vi.fn();
const mockProfilesSafeSelect = vi.fn();
const mockProfilesUpdate = vi.fn();
const mockUserRolesUpsert = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
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

describe('AddMemberDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

  test('adds a member and assigns the selected role', async () => {
    const onOpenChange = vi.fn();
    const onMemberAdded = vi.fn();

    render(
      <AddMemberDialog
        open
        onOpenChange={onOpenChange}
        organizationId="org-1"
        organizationName="Acme Resort"
        onMemberAdded={onMemberAdded}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /jane doe/i }));
    fireEvent.click(screen.getByRole('button', { name: /add member/i }));

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

    expect(onMemberAdded).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Member Added',
      })
    );
  });

  test('rolls back the profile assignment when role assignment fails', async () => {
    mockUserRolesUpsert.mockResolvedValueOnce({
      error: { message: 'permission denied for table user_roles' },
    });

    render(
      <AddMemberDialog
        open
        onOpenChange={vi.fn()}
        organizationId="org-1"
        organizationName="Acme Resort"
        onMemberAdded={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /jane doe/i }));
    fireEvent.click(screen.getByRole('button', { name: /add member/i }));

    await waitFor(() => {
      expect(mockProfilesUpdate).toHaveBeenNthCalledWith(1, { organization_id: 'org-1' });
      expect(mockProfilesUpdate).toHaveBeenNthCalledWith(2, { organization_id: null });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'permission denied for table user_roles',
        variant: 'destructive',
      })
    );
  });
});