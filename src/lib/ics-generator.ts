import { CalendarEvent } from '@/hooks/useGoogleCalendar';
import { parseISO, format, formatISO } from 'date-fns';
import { devError } from '@/lib/logger';

/**
 * Generate ICS format for a single event
 * RFC 5545 compliant
 */
function generateEventICS(event: CalendarEvent): string {
  const lines: string[] = [];
  
  lines.push('BEGIN:VEVENT');
  
  // Required properties
  lines.push(`UID:${event.id}@google-calendar`);
  lines.push(`DTSTAMP:${formatISO(new Date(), { representation: 'date' }).replace(/-/g, '')}`);
  lines.push(`SUMMARY:${escapeICSString(event.title)}`);
  
  // Date/time properties
  if (event.allDay) {
    const dateStr = event.startTime.slice(0, 10).replace(/-/g, '');
    lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
    const endDate = new Date(event.endTime);
    endDate.setDate(endDate.getDate() + 1);
    const endDateStr = format(endDate, 'yyyyMMdd');
    lines.push(`DTEND;VALUE=DATE:${endDateStr}`);
  } else {
    lines.push(`DTSTART:${formatISO(parseISO(event.startTime), { representation: 'complete' }).replace(/[-:]/g, '').replace(/\.000/, '')}`);
    lines.push(`DTEND:${formatISO(parseISO(event.endTime), { representation: 'complete' }).replace(/[-:]/g, '').replace(/\.000/, '')}`);
  }
  
  // Optional properties
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICSString(event.description)}`);
  }
  
  if (event.attendees && event.attendees.length > 0) {
    event.attendees.forEach(attendee => {
      lines.push(`ATTENDEE;CN=${escapeICSString(attendee)}:mailto:${attendee}`);
    });
  }
  
  // Timezone
  if (event.calendarTimeZone && !event.allDay) {
    lines.push(`TZID:${event.calendarTimeZone}`);
  }
  
  // Recurrence
  if (event.recurrenceRule) {
    lines.push(`RRULE:${event.recurrenceRule}`);
  }
  
  // Transparency (busy/free)
  lines.push('TRANSP:OPAQUE');
  
  // Status
  lines.push('STATUS:CONFIRMED');
  
  lines.push('END:VEVENT');
  
  return lines.join('\r\n');
}

/**
 * Escape special characters in ICS strings
 */
function escapeICSString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Generate complete ICS file content
 */
export function generateICS(events: CalendarEvent[], calendarName: string = 'My Calendar'): string {
  const lines: string[] = [];
  
  // ICS header
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Canvas Capital//Calendar//EN');
  lines.push(`CALSCALE:GREGORIAN`);
  lines.push(`METHOD:PUBLISH`);
  lines.push(`X-WR-CALNAME:${escapeICSString(calendarName)}`);
  lines.push(`X-WR-TIMEZONE:UTC`);
  lines.push(`X-WR-CALDESC:Exported calendar from Canvas Capital`);
  
  // Add events
  events.forEach(event => {
    lines.push(generateEventICS(event));
  });
  
  // ICS footer
  lines.push('END:VCALENDAR');
  
  return lines.join('\r\n');
}

/**
 * Download ICS file
 */
export function downloadICS(content: string, filename: string = 'calendar.ics'): void {
  const element = document.createElement('a');
  element.setAttribute('href', `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`);
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

/**
 * Copy ICS content to clipboard
 */
export async function copyICSToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch (err) {
    devError('Failed to copy to clipboard:', err);
    return false;
  }
}

/**
 * Generate ICS for events in date range
 */
export function generateICSForDateRange(
  events: CalendarEvent[],
  startDate: Date,
  endDate: Date,
  calendarName: string = 'My Calendar'
): string {
  const filteredEvents = events.filter(event => {
    const eventStart = parseISO(event.startTime);
    const eventEnd = parseISO(event.endTime);
    return eventStart >= startDate && eventEnd <= endDate;
  });
  
  return generateICS(filteredEvents, calendarName);
}
