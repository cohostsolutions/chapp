export const CALENDAR_SYNC_INTERVAL_MS = 10 * 60 * 1000;
export const CALENDAR_SYNC_WARNING_MS = 15 * 60 * 1000;
export const CALENDAR_SYNC_STALE_MS = 30 * 60 * 1000;

export type CalendarSyncStatus = 'no-integrations' | 'never-synced' | 'fresh' | 'warning' | 'stale';

export interface CalendarSyncHealth {
  status: CalendarSyncStatus;
  hasIntegration: boolean;
  integratedRoomCount: number;
  lastSyncTime: Date | null;
  minutesSinceLastSync: number | null;
}

export function getCalendarSyncHealth(
  lastSyncTime: Date | null,
  integratedRoomCount: number,
  now = new Date(),
): CalendarSyncHealth {
  if (integratedRoomCount === 0) {
    return {
      status: 'no-integrations',
      hasIntegration: false,
      integratedRoomCount,
      lastSyncTime,
      minutesSinceLastSync: null,
    };
  }

  if (!lastSyncTime) {
    return {
      status: 'never-synced',
      hasIntegration: true,
      integratedRoomCount,
      lastSyncTime: null,
      minutesSinceLastSync: null,
    };
  }

  const minutesSinceLastSync = Math.max(
    0,
    Math.round((now.getTime() - lastSyncTime.getTime()) / 60000),
  );

  let status: CalendarSyncStatus = 'fresh';

  if (minutesSinceLastSync >= CALENDAR_SYNC_STALE_MS / 60000) {
    status = 'stale';
  } else if (minutesSinceLastSync >= CALENDAR_SYNC_WARNING_MS / 60000) {
    status = 'warning';
  }

  return {
    status,
    hasIntegration: true,
    integratedRoomCount,
    lastSyncTime,
    minutesSinceLastSync,
  };
}