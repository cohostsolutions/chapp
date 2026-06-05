import { describe, expect, test } from 'vitest';
import {
  CECE_DAILY_EXPENSE_TYPES,
  CECE_MONTHLY_EXPENSE_TYPES,
  getOperationsExpenseTypes,
  JAY_DAILY_EXPENSE_TYPES,
  MAY_MONTHLY_EXPENSE_TYPES,
} from '../operationsExpenseTypes';
import { getDateRangeFromPeriod } from '@/components/operations/PeriodFilter';

describe('operationsExpenseTypes', () => {
  test('returns Jay-specific expense taxonomies', () => {
    const types = getOperationsExpenseTypes('jay');

    expect(types.daily).toEqual(JAY_DAILY_EXPENSE_TYPES);
    expect(types.monthly).toContain('office_rent');
    expect(types.monthly).not.toContain('Building Dues / HOA');
  });

  test('keeps Cece expense taxonomies available as the default operations set', () => {
    const types = getOperationsExpenseTypes('cece');

    expect(types.daily).toEqual(CECE_DAILY_EXPENSE_TYPES);
    expect(types.monthly).toEqual(CECE_MONTHLY_EXPENSE_TYPES);
  });

  test('returns May-specific monthly taxonomy', () => {
    const types = getOperationsExpenseTypes('may');

    expect(types.monthly).toEqual(MAY_MONTHLY_EXPENSE_TYPES);
    expect(types.daily).toContain('ingredients');
  });
});

describe('getDateRangeFromPeriod', () => {
  test('normalizes reversed custom date ranges', () => {
    const later = new Date('2026-04-20T00:00:00.000Z');
    const earlier = new Date('2026-04-10T00:00:00.000Z');

    const range = getDateRangeFromPeriod('custom', later, earlier);

    expect(range.start).toEqual(earlier);
    expect(range.end).toEqual(later);
  });
});