import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { OrgDrilldownDialog } from '@/components/dashboard/OrgDrilldownDialog';

vi.mock('@/hooks/useMultiCurrency', () => ({
  useFormatCurrency: () => (amount: number) => `$${amount.toLocaleString()}`,
}));

vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: any }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    AreaChart: Stub,
    Area: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
    PieChart: Stub,
    Pie: Stub,
    Cell: Stub,
    Legend: Stub,
  };
});

type QueryResult = { data?: unknown; count?: number | null };

const mockedSupabase = vi.hoisted(() => {
  const queryQueue: QueryResult[] = [];

  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      single: vi.fn(async () => queryQueue.shift() ?? { data: null }),
      then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(resolve(queryQueue.shift() ?? { data: [] })),
    };

    return builder;
  };

  return {
    queryQueue,
    fromMock: vi.fn(() => createBuilder()),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockedSupabase.fromMock,
  },
}));

describe('OrgDrilldownDialog', () => {
  beforeEach(() => {
    mockedSupabase.fromMock.mockClear();
    mockedSupabase.queryQueue.length = 0;
  });

  test('uses booking revenue labels and totals for Cece revenue tab', async () => {
    mockedSupabase.queryQueue.push(
      {
        data: [
          { id: 'lead-1', status: 'new', lead_temperature: 'warm', created_at: '2026-04-01T12:00:00.000Z' },
        ],
      },
      {
        data: [
          { id: 'order-1', total_amount: 900, created_at: '2026-04-02T12:00:00.000Z' },
        ],
      },
      {
        data: [
          { id: 'booking-1', total_price: 2500, status: 'confirmed', created_at: '2026-04-03T12:00:00.000Z' },
          { id: 'booking-2', total_price: 1800, status: 'checked_in', created_at: '2026-04-04T12:00:00.000Z' },
          { id: 'booking-3', total_price: 9999, status: 'cancelled', created_at: '2026-04-05T12:00:00.000Z' },
        ],
      },
      {
        data: [
          { id: 'conversation-1', status: 'active', created_at: '2026-04-03T12:00:00.000Z' },
        ],
      },
      {
        data: [
          { id: 'user-1', full_name: 'Ava Host', email: 'ava@example.com' },
        ],
      },
      {
        data: [
          { user_id: 'user-1', role: 'agent' },
        ],
      },
      { data: [] },
      { data: [] },
      { data: [] },
      { data: [] },
    );

    render(
      <OrgDrilldownDialog
        open={true}
        onOpenChange={vi.fn()}
        orgId="org-cece"
        orgName="Cece Hospitality"
        aiAgentType="cece"
        dateRange={{
          from: new Date('2026-04-01T00:00:00.000Z'),
          to: new Date('2026-04-07T00:00:00.000Z'),
        }}
      />
    );

    await waitFor(() => expect(screen.getByText('Total Inquiries')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('tab', { name: 'Revenue' }));

    await waitFor(() => {
      expect(screen.getByText('Total Bookings')).toBeInTheDocument();
      expect(screen.getByText('Avg Booking Value')).toBeInTheDocument();
      expect(screen.getByText('$4,300')).toBeInTheDocument();
      expect(screen.getByText('$2,150')).toBeInTheDocument();
    });

    expect(screen.queryByText('$900')).not.toBeInTheDocument();
  });
});