export type OperationsVariant = 'cece';

export const CECE_DAILY_EXPENSE_TYPES = [
  'Cleaning',
  'Laundry',
  'Supplies',
  'Runner Transpo',
  'Others',
] as const;

export const CECE_MONTHLY_EXPENSE_TYPES = [
  'Electricity',
  'Water',
  'Wi-Fi',
  'Building Dues / HOA',
  'Deep Cleaning',
  'Subscriptions',
  'Management Fee',
  'Garbage / Waste',
  'Maintenance',
  'Others',
] as const;

export const OPERATIONS_EXPENSE_TYPES = {
  cece: {
    daily: CECE_DAILY_EXPENSE_TYPES,
    monthly: CECE_MONTHLY_EXPENSE_TYPES,
  },
} as const;

export function getOperationsExpenseTypes(variant: OperationsVariant) {
  return OPERATIONS_EXPENSE_TYPES[variant];
}