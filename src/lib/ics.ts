import type { PlannerCalendarEvent } from '../types/domain';
import { createUuid } from './id';

function unfoldLines(content: string): string[] {
  const rawLines = content.replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];

  for (const line of rawLines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      const previous = lines.pop() ?? '';
      lines.push(`${previous}${line.slice(1)}`);
    } else {
      lines.push(line);
    }
  }

  return lines;
}

function parseIcsDate(value: string): string | null {
  const trimmed = value.trim();

  if (/^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6)) - 1;
    const day = Number(trimmed.slice(6, 8));
    return new Date(Date.UTC(year, month, day, 9, 0, 0)).toISOString();
  }

  if (/^\d{8}T\d{6}Z$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6)) - 1;
    const day = Number(trimmed.slice(6, 8));
    const hour = Number(trimmed.slice(9, 11));
    const minute = Number(trimmed.slice(11, 13));
    const second = Number(trimmed.slice(13, 15));
    return new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString();
  }

  if (/^\d{8}T\d{6}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6)) - 1;
    const day = Number(trimmed.slice(6, 8));
    const hour = Number(trimmed.slice(9, 11));
    const minute = Number(trimmed.slice(11, 13));
    const second = Number(trimmed.slice(13, 15));
    const date = new Date(year, month, day, hour, minute, second);
    return date.toISOString();
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function parseIcsEvents(content: string): PlannerCalendarEvent[] {
  const lines = unfoldLines(content);
  const events: PlannerCalendarEvent[] = [];

  let active: { title?: string; start?: string; end?: string } | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      active = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      if (active?.title && active.start && active.end) {
        events.push({
          id: createUuid(),
          title: active.title,
          start: active.start,
          end: active.end,
          source: 'ics',
        });
      }
      active = null;
      continue;
    }

    if (!active) {
      continue;
    }

    if (line.startsWith('SUMMARY:')) {
      active.title = line.slice('SUMMARY:'.length).trim();
      continue;
    }

    if (line.startsWith('DTSTART')) {
      const [, value = ''] = line.split(':', 2);
      active.start = parseIcsDate(value) ?? undefined;
      continue;
    }

    if (line.startsWith('DTEND')) {
      const [, value = ''] = line.split(':', 2);
      active.end = parseIcsDate(value) ?? undefined;
      continue;
    }
  }

  return events;
}

export async function fetchAndParseIcs(url: string): Promise<PlannerCalendarEvent[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ICS (${response.status})`);
  }

  const text = await response.text();
  return parseIcsEvents(text);
}
