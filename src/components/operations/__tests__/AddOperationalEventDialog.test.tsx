import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddOperationalEventDialog } from '@/components/operations/AddOperationalEventDialog';

describe('AddOperationalEventDialog', () => {
  test('supports general-only mode for Jay and May operations', () => {
    render(
      <AddOperationalEventDialog
        open={true}
        onOpenChange={vi.fn()}
        onSubmitGeneralEvent={vi.fn().mockResolvedValue(undefined)}
        roomUnits={[{ id: 'room-1', name: 'Room 1' }]}
        saving={false}
        isCalendarConnected={true}
        supportedEventTypes={['general']}
      />
    );

    expect(screen.getByPlaceholderText('Event title')).toBeInTheDocument();
    expect(screen.queryByText('Block Room')).not.toBeInTheDocument();
    expect(screen.queryByText('Room / Unit *')).not.toBeInTheDocument();
  });

  test('supports maintenance-only mode for Cece room blocking flows', () => {
    render(
      <AddOperationalEventDialog
        open={true}
        onOpenChange={vi.fn()}
        onSubmitMaintenance={vi.fn().mockResolvedValue(undefined)}
        roomUnits={[{ id: 'room-1', name: 'Room 1' }]}
        saving={false}
        isCalendarConnected={true}
        supportedEventTypes={['maintenance']}
      />
    );

    expect(screen.getByText('Room / Unit *')).toBeInTheDocument();
    expect(screen.queryByText('Calendar Event')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Block Room' })).toBeInTheDocument();
  });
});