import { describe, it, expect, vi } from 'vitest';
import { 
  generateICS, 
  downloadICS, 
  copyICSToClipboard, 
  generateICSForDateRange 
} from '@/lib/ics-generator';
import { CalendarEvent } from '@/hooks/useGoogleCalendar';

const mockEvent: CalendarEvent = {
  id: 'event-123',
  title: 'Test Meeting',
  description: 'This is a test meeting with special chars: , ; \ \n',
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T11:00:00Z',
  allDay: false,
  attendees: ['alice@example.com', 'bob@example.com'],
  calendarId: 'primary',
  calendarTimeZone: 'America/New_York',
};

const mockAllDayEvent: CalendarEvent = {
  id: 'event-456',
  title: 'All Day Event',
  startTime: '2024-01-15T00:00:00Z',
  endTime: '2024-01-16T00:00:00Z',
  allDay: true,
  calendarId: 'primary',
};

const mockRecurringEvent: CalendarEvent = {
  id: 'event-789',
  title: 'Weekly Standup',
  startTime: '2024-01-15T09:00:00Z',
  endTime: '2024-01-15T09:30:00Z',
  allDay: false,
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
  calendarId: 'primary',
};

describe('ICS Generator', () => {
  describe('generateICS', () => {
    it('generates valid ICS header', () => {
      const ics = generateICS([mockEvent], 'My Calendar');
      
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//Canvas Capital//Calendar//EN');
      expect(ics).toContain('X-WR-CALNAME:My Calendar');
      expect(ics).toContain('END:VCALENDAR');
    });

    it('includes event title', () => {
      const ics = generateICS([mockEvent]);
      
      expect(ics).toContain('SUMMARY:Test Meeting');
    });

    it('includes event description', () => {
      const ics = generateICS([mockEvent]);
      
      expect(ics).toContain('DESCRIPTION:');
      // Should escape special characters
      expect(ics).toContain('\\,');
      expect(ics).toContain('\\;');
      expect(ics).toContain('\\n');
    });

    it('includes attendees with mailto', () => {
      const ics = generateICS([mockEvent]);
      
      expect(ics).toContain('ATTENDEE;CN=alice@example.com:mailto:alice@example.com');
      expect(ics).toContain('ATTENDEE;CN=bob@example.com:mailto:bob@example.com');
    });

    it('handles all-day events correctly', () => {
      const ics = generateICS([mockAllDayEvent]);
      
      expect(ics).toMatch(/DTSTART;VALUE=DATE:\d{8}/);
      expect(ics).toMatch(/DTEND;VALUE=DATE:\d{8}/);
      expect(ics).not.toMatch(/DTSTART:.*T/);
      expect(ics).not.toMatch(/DTEND:.*T/);
    });

    it('includes recurrence rules', () => {
      const ics = generateICS([mockRecurringEvent]);
      
      expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
    });

    it('includes timezone information', () => {
      const ics = generateICS([mockEvent]);
      
      expect(ics).toContain('TZID:America/New_York');
    });

    it('generates multiple events', () => {
      const ics = generateICS([mockEvent, mockAllDayEvent, mockRecurringEvent]);
      
      expect(ics).toContain('Test Meeting');
      expect(ics).toContain('All Day Event');
      expect(ics).toContain('Weekly Standup');
      expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(3);
    });

    it('handles empty event list', () => {
      const ics = generateICS([], 'Empty Calendar');
      
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('X-WR-CALNAME:Empty Calendar');
      expect(ics).toContain('END:VCALENDAR');
      expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(0);
    });
  });

  describe('escapeICSString', () => {
    it('escapes special characters in titles', () => {
      const events: CalendarEvent[] = [{
        id: '1',
        title: 'Meeting: Planning; Phase 1',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T11:00:00Z',
        calendarId: 'primary',
      }];

      const ics = generateICS(events);
      
      expect(ics).toContain('SUMMARY:Meeting: Planning\\; Phase 1');
    });

    it('handles commas in descriptions', () => {
      const events: CalendarEvent[] = [{
        id: '1',
        title: 'Event',
        description: 'Meeting with Alice, Bob, and Carol',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T11:00:00Z',
        calendarId: 'primary',
      }];

      const ics = generateICS(events);
      
      expect(ics).toContain('DESCRIPTION:Meeting with Alice\\, Bob\\, and Carol');
    });
  });

  describe('downloadICS', () => {
    it('creates download link with correct attributes', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      downloadICS('test content', 'test.ics');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  describe('copyICSToClipboard', () => {
    it('copies content to clipboard', async () => {
      const mockClipboard = {
        writeText: vi.fn(() => Promise.resolve()),
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      const success = await copyICSToClipboard('test content');

      expect(success).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('test content');
    });

    it('returns false on clipboard error', async () => {
      const mockClipboard = {
        writeText: vi.fn(() => Promise.reject(new Error('Clipboard error'))),
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      const success = await copyICSToClipboard('test content');

      expect(success).toBe(false);
    });
  });

  describe('generateICSForDateRange', () => {
    it('filters events within date range', () => {
      const events: CalendarEvent[] = [
        { ...mockEvent, id: '1', startTime: '2024-01-10T10:00:00Z', endTime: '2024-01-10T11:00:00Z' },
        { ...mockEvent, id: '2', startTime: '2024-01-15T10:00:00Z', endTime: '2024-01-15T11:00:00Z' },
        { ...mockEvent, id: '3', startTime: '2024-01-20T10:00:00Z', endTime: '2024-01-20T11:00:00Z' },
      ];

      const startDate = new Date('2024-01-12');
      const endDate = new Date('2024-01-18');

      const ics = generateICSForDateRange(events, startDate, endDate);

      expect(ics).toContain('BEGIN:VCALENDAR');
      // Should only include the middle event
      expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(1);
    });

    it('excludes events outside date range', () => {
      const events: CalendarEvent[] = [
        { ...mockEvent, id: '1', startTime: '2024-01-10T10:00:00Z', endTime: '2024-01-10T11:00:00Z' },
        { ...mockEvent, id: '2', startTime: '2024-01-25T10:00:00Z', endTime: '2024-01-25T11:00:00Z' },
      ];

      const startDate = new Date('2024-01-12');
      const endDate = new Date('2024-01-23');

      const ics = generateICSForDateRange(events, startDate, endDate);

      expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(0);
    });
  });
});
