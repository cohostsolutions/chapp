import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useState } from 'react';
import { LocationPickerFields } from '@/components/shared/LocationPickerFields';
import type { PricingLocationSelection } from '@/lib/pricingLocationCatalog';

function TestHarness({ initialValue }: { initialValue: PricingLocationSelection }) {
  const [value, setValue] = useState<PricingLocationSelection>(initialValue);

  return (
    <LocationPickerFields
      value={value}
      onChange={setValue}
    />
  );
}

async function chooseOption(triggerText: string, searchPlaceholder: string, optionText: string) {
  fireEvent.click(screen.getByRole('combobox', { name: triggerText }));
  fireEvent.change(screen.getByPlaceholderText(searchPlaceholder), { target: { value: optionText } });
  fireEvent.click(await screen.findByText(optionText));
}

describe('LocationPickerFields', () => {
  test('changing country clears region, city, and district', async () => {
    render(
      <TestHarness
        initialValue={{
          country: 'Philippines',
          region: 'Metro Manila',
          city: 'Manila',
          district: 'Binondo',
        }}
      />
    );

    await chooseOption('Philippines', 'Search country...', 'Japan');

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Japan' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Select region' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Select city' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'No district options' })).toBeInTheDocument();
    });
  });

  test('changing region clears city and district while preserving country', async () => {
    render(
      <TestHarness
        initialValue={{
          country: 'Philippines',
          region: 'Metro Manila',
          city: 'Makati',
          district: 'Poblacion',
        }}
      />
    );

    await chooseOption('Metro Manila', 'Search region...', 'Central Visayas');

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Philippines' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Central Visayas' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Select city' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'No district options' })).toBeInTheDocument();
    });
  });

  test('changing city clears district while preserving country and region', async () => {
    render(
      <TestHarness
        initialValue={{
          country: 'Philippines',
          region: 'Metro Manila',
          city: 'Manila',
          district: 'Binondo',
        }}
      />
    );

    await chooseOption('Manila', 'Search city...', 'Makati');

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Philippines' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Metro Manila' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Makati' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Select district' })).toBeInTheDocument();
    });
  });
});