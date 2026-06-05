import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PricingTabContent } from '../PricingTabContent';

const mockToast = vi.fn();
const mockCreateProfileMutateAsync = vi.fn();
const mockUpdateProfileMutateAsync = vi.fn();
const mockDeleteProfileMutate = vi.fn();
const mockSeedProfilesMutate = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/components/shared/LocationPickerFields', () => ({
  LocationPickerFields: ({ value, onChange }: { value: any; onChange: (v: any) => void }) => (
    <div>
      <label htmlFor="country-input">Country</label>
      <input
        id="country-input"
        value={value.country}
        onChange={(e) => onChange({ ...value, country: e.target.value })}
      />
      <label htmlFor="city-input">City</label>
      <input
        id="city-input"
        value={value.city}
        onChange={(e) => onChange({ ...value, city: e.target.value })}
      />
      <label htmlFor="district-input">District</label>
      <input
        id="district-input"
        value={value.district}
        onChange={(e) => onChange({ ...value, district: e.target.value })}
      />
    </div>
  ),
}));

const mockUsePricingMarketProfiles = vi.fn();
vi.mock('@/hooks/usePricingMarketProfiles', () => ({
  usePricingMarketProfiles: () => mockUsePricingMarketProfiles(),
}));

function defaultProfilesHook(overrides: Record<string, unknown> = {}) {
  return {
    profiles: [],
    activeProfiles: [],
    isLoading: false,
    createProfile: { mutateAsync: mockCreateProfileMutateAsync, isPending: false },
    updateProfile: { mutateAsync: mockUpdateProfileMutateAsync, isPending: false },
    deleteProfile: { mutate: mockDeleteProfileMutate, isPending: false },
    seedDefaultProfiles: { mutate: mockSeedProfilesMutate, isPending: false },
    ...overrides,
  };
}

describe('PricingTabContent targeted behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePricingMarketProfiles.mockReturnValue(defaultProfilesHook());
  });

  test('shows seed recommended button when no profiles and triggers seed', () => {
    render(<PricingTabContent properties={[]} rooms={[]} />);

    const seedButton = screen.getByRole('button', { name: 'Seed Recommended' });
    fireEvent.click(seedButton);

    expect(mockSeedProfilesMutate).toHaveBeenCalled();
  });

  test('creates new pricing profile with inferred district scope', async () => {
    render(<PricingTabContent properties={[]} rooms={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Profile' }));

    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Philippines' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Taguig' } });
    fireEvent.change(screen.getByLabelText('District'), { target: { value: 'BGC' } });

    fireEvent.change(screen.getByLabelText('Multiplier'), { target: { value: '1.18' } });
    fireEvent.change(screen.getByLabelText('Display Order'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Market Positioning'), { target: { value: 'Prime market' } });
    fireEvent.change(screen.getByLabelText('Adjustment Label'), { target: { value: 'prime premium' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Profile' }));

    await waitFor(() => {
      expect(mockCreateProfileMutateAsync).toHaveBeenCalled();
    });

    expect(mockCreateProfileMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'district',
      country: 'Philippines',
      city: 'Taguig',
      district: 'BGC',
      multiplier: 1.18,
      display_order: 5,
      market_positioning: 'Prime market',
      adjustment_label: 'prime premium',
    }));
  });

  test('supports editing and deleting existing profile', async () => {
    mockUsePricingMarketProfiles.mockReturnValue(defaultProfilesHook({
      profiles: [{
        id: 'profile-1',
        organization_id: 'org-1',
        scope: 'city',
        country: 'Philippines',
        region: 'Metro Manila',
        city: 'Makati',
        district: null,
        multiplier: 1.12,
        market_positioning: 'Premium city market',
        adjustment_label: 'city premium',
        is_active: true,
        display_order: 10,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }],
      activeProfiles: [{ id: 'profile-1' }],
    }));

    render(<PricingTabContent properties={[]} rooms={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Adjustment Label'), { target: { value: 'updated premium' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockUpdateProfileMutateAsync).toHaveBeenCalled();
    });

    expect(mockUpdateProfileMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      id: 'profile-1',
      input: expect.objectContaining({ adjustment_label: 'updated premium' }),
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete city premium' }));
    expect(mockDeleteProfileMutate).toHaveBeenCalledWith('profile-1');
  });

  test('disables create when multiplier is above cap', () => {
    render(<PricingTabContent properties={[]} rooms={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Profile' }));

    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Philippines' } });
    fireEvent.change(screen.getByLabelText('Multiplier'), { target: { value: '3.5' } });
    fireEvent.change(screen.getByLabelText('Display Order'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Market Positioning'), { target: { value: 'Prime market' } });
    fireEvent.change(screen.getByLabelText('Adjustment Label'), { target: { value: 'premium' } });

    expect(screen.getByRole('button', { name: 'Create Profile' })).toBeDisabled();
  });

  test('blocks delete and shows toast when profile is currently in use', () => {
    mockUsePricingMarketProfiles.mockReturnValue(defaultProfilesHook({
      profiles: [{
        id: 'profile-2',
        organization_id: 'org-1',
        scope: 'city',
        country: 'Philippines',
        region: 'Metro Manila',
        city: 'Makati',
        district: null,
        multiplier: 1.12,
        market_positioning: 'Premium city market',
        adjustment_label: 'makati premium',
        is_active: true,
        display_order: 10,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }],
      activeProfiles: [{ id: 'profile-2' }],
    }));

    render(
      <PricingTabContent
        properties={[
          {
            id: 'property-1',
            organization_id: 'org-1',
            name: 'Makati Property',
            description: null,
            city: 'Makati',
            region: 'Metro Manila',
            country: 'Philippines',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ] as any}
        rooms={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete makati premium' }));

    expect(mockDeleteProfileMutate).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Profile in use',
    }));
  });
});
