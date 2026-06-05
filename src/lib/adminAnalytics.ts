export const CECE_REVENUE_STATUSES = ['upcoming', 'checked_in', 'checked_out', 'completed', 'confirmed'] as const;

type AgentType = 'jay' | 'may' | 'cece';

interface OrderRevenueRecord {
  created_at?: string | null;
  total_amount?: number | string | null;
}

interface BookingRevenueRecord {
  created_at?: string | null;
  status?: string | null;
  total_price?: number | string | null;
}

export interface RevenueEvent {
  createdAt: string;
  amount: number;
}

const toNumber = (value: number | string | null | undefined): number => Number(value) || 0;

export function getAgentRevenueEvents(
  agentType: AgentType,
  orders: OrderRevenueRecord[] = [],
  bookings: BookingRevenueRecord[] = []
): RevenueEvent[] {
  if (agentType === 'cece') {
    return bookings
      .filter((booking) => CECE_REVENUE_STATUSES.includes(String(booking.status) as (typeof CECE_REVENUE_STATUSES)[number]))
      .filter((booking) => Boolean(booking.created_at))
      .map((booking) => ({
        createdAt: String(booking.created_at),
        amount: toNumber(booking.total_price),
      }));
  }

  return orders
    .filter((order) => Boolean(order.created_at))
    .map((order) => ({
      createdAt: String(order.created_at),
      amount: toNumber(order.total_amount),
    }));
}

export function getAgentRevenueTotal(
  agentType: AgentType,
  orders: OrderRevenueRecord[] = [],
  bookings: BookingRevenueRecord[] = []
): number {
  return getAgentRevenueEvents(agentType, orders, bookings).reduce((sum, event) => sum + event.amount, 0);
}

export function getAgentTransactionCount(
  agentType: AgentType,
  orders: OrderRevenueRecord[] = [],
  bookings: BookingRevenueRecord[] = []
): number {
  return getAgentRevenueEvents(agentType, orders, bookings).length;
}