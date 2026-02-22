import { describe, expect, it } from 'vitest';

import { parseIcsEvents } from './ics';

describe('parseIcsEvents', () => {
  it('parses VEVENT blocks from ICS text', () => {
    const content = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Team Standup\nDTSTART:20260301T150000Z\nDTEND:20260301T153000Z\nEND:VEVENT\nEND:VCALENDAR`;

    const events = parseIcsEvents(content);
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('Team Standup');
    expect(events[0]?.source).toBe('ics');
  });
});
