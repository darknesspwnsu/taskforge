import {
  addDays,
  addMinutes,
  differenceInMinutes,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
} from 'date-fns';

import type {
  PlannerCalendarEvent,
  PlannerPreferences,
  PlannerSuggestion,
  Task,
  TaskOccurrence,
  WeekdayCode,
} from '../types/domain';
import type { TaskForgeSnapshot } from '../types/state';
import { createUuid } from './id';

type DateRange = { start: Date; end: Date };

const WEEKDAY_CODES: WeekdayCode[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseTimeRange(referenceDate: Date, time: string): Date {
  const [hourPart, minutePart] = time.split(':');
  const hour = Number(hourPart ?? 0);
  const minute = Number(minutePart ?? 0);

  const output = new Date(referenceDate);
  output.setHours(hour, minute, 0, 0);
  return output;
}

function toRangesForDay(date: Date, windows: { start: string; end: string }[]): DateRange[] {
  return windows.flatMap((window) => {
    const start = parseTimeRange(date, window.start);
    let end = parseTimeRange(date, window.end);

    if (!isAfter(end, start)) {
      end = addDays(end, 1);
    }

    if (!isAfter(end, date) && !isAfter(end, start)) {
      return [];
    }

    return [{ start, end }];
  });
}

function normalizeRange(range: DateRange): DateRange | null {
  if (!isAfter(range.end, range.start)) {
    return null;
  }

  return range;
}

function overlaps(left: DateRange, right: DateRange): boolean {
  return isBefore(left.start, right.end) && isBefore(right.start, left.end);
}

function subtractRange(base: DateRange, blocked: DateRange): DateRange[] {
  if (!overlaps(base, blocked)) {
    return [base];
  }

  const output: DateRange[] = [];

  if (isAfter(blocked.start, base.start)) {
    output.push({
      start: base.start,
      end: blocked.start,
    });
  }

  if (isBefore(blocked.end, base.end)) {
    output.push({
      start: blocked.end,
      end: base.end,
    });
  }

  return output.map(normalizeRange).filter(Boolean) as DateRange[];
}

function subtractBlockedRanges(available: DateRange[], blocked: DateRange[]): DateRange[] {
  let output = [...available];

  for (const blockedRange of blocked) {
    output = output.flatMap((range) => subtractRange(range, blockedRange));
  }

  return output
    .filter((range) => differenceInMinutes(range.end, range.start) > 0)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function weekdayCode(date: Date): WeekdayCode {
  return WEEKDAY_CODES[date.getDay()] ?? 'MO';
}

function isWeekday(code: WeekdayCode): boolean {
  return ['MO', 'TU', 'WE', 'TH', 'FR'].includes(code);
}

export function estimateTaskMinutes(task: Pick<Task, 'estimatedMinutes' | 'effort'>): number {
  if (task.estimatedMinutes && task.estimatedMinutes > 0) {
    return clamp(Math.round(task.estimatedMinutes), 15, 240);
  }

  if (task.effort === 'quick') {
    return 30;
  }

  if (task.effort === 'deep') {
    return 90;
  }

  return 60;
}

export function chunkTaskMinutes(totalMinutes: number, maxSessionMinutes: number): number[] {
  const maxChunk = clamp(Math.round(maxSessionMinutes || 60), 20, 90);
  let remaining = clamp(Math.round(totalMinutes), 15, 600);
  const chunks: number[] = [];

  while (remaining > 0) {
    let next = Math.min(maxChunk, remaining);

    if (remaining - next > 0 && remaining - next < 20) {
      next += remaining - next;
    }

    chunks.push(next);
    remaining -= next;
  }

  return chunks;
}

type CandidateTask = {
  occurrence: TaskOccurrence;
  task: Task;
  minutes: number;
};

function pendingCandidateTasks(snapshot: TaskForgeSnapshot): CandidateTask[] {
  const tasksById = new Map(snapshot.tasks.map((task) => [task.id, task]));

  return snapshot.occurrences
    .filter((occurrence) => occurrence.status === 'pending')
    .map((occurrence) => {
      const task = tasksById.get(occurrence.taskId);
      if (!task || task.taskKind === 'complex_parent') {
        return null;
      }

      return {
        occurrence,
        task,
        minutes: estimateTaskMinutes(task),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftDue = left?.occurrence.dueAt ? parseISO(left.occurrence.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right?.occurrence.dueAt ? parseISO(right.occurrence.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue;
    }) as CandidateTask[];
}

function calendarEventsForDay(date: Date, events: PlannerCalendarEvent[]): DateRange[] {
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);

  return events
    .map((event) => ({
      start: parseISO(event.start),
      end: parseISO(event.end),
    }))
    .filter((event) => overlaps(event, { start: dayStart, end: dayEnd }));
}

function availabilityForDay(
  date: Date,
  preferences: PlannerPreferences,
  events: PlannerCalendarEvent[],
): DateRange[] {
  const dayCode = weekdayCode(date);
  const baseFreeWindows = isWeekday(dayCode) ? preferences.freeWeekdays : preferences.freeWeekends;

  const freeRanges = toRangesForDay(date, baseFreeWindows);

  const blockedRanges = [
    ...toRangesForDay(date, preferences.sleepDaily),
    ...(isWeekday(dayCode) ? toRangesForDay(date, preferences.workWeekdays) : []),
    ...calendarEventsForDay(date, events),
  ];

  return subtractBlockedRanges(freeRanges, blockedRanges);
}

function assignChunk(
  available: DateRange[],
  minutes: number,
  dueAt: Date | undefined,
): { updated: DateRange[]; start?: Date; end?: Date } {
  const sorted = [...available].sort((a, b) => a.start.getTime() - b.start.getTime());

  const eligibleIndexes = sorted
    .map((range, index) => ({ range, index }))
    .filter(({ range }) => differenceInMinutes(range.end, range.start) >= minutes);

  const preferred = eligibleIndexes.find(({ range }) => {
    if (!dueAt) {
      return true;
    }

    return isBefore(addMinutes(range.start, minutes), dueAt) || addMinutes(range.start, minutes).getTime() === dueAt.getTime();
  });

  const chosen = preferred ?? eligibleIndexes[0];

  if (!chosen) {
    return { updated: sorted };
  }

  const start = chosen.range.start;
  const end = addMinutes(start, minutes);

  const updated = [...sorted];
  const selected = updated[chosen.index];

  if (differenceInMinutes(selected.end, end) <= 0) {
    updated.splice(chosen.index, 1);
  } else {
    updated[chosen.index] = {
      start: end,
      end: selected.end,
    };
  }

  return {
    updated,
    start,
    end,
  };
}

export function generateHeuristicPlannerSuggestions(input: {
  snapshot: TaskForgeSnapshot;
  startDate?: Date;
  days?: number;
}): PlannerSuggestion[] {
  const startDate = input.startDate ?? new Date();
  const days = input.days ?? 7;
  const candidates = pendingCandidateTasks(input.snapshot);
  const preferences = input.snapshot.settings.planner;
  const events = input.snapshot.plannerCalendarEvents;

  const availableByDay = new Map<string, DateRange[]>();

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const date = addDays(startOfDay(startDate), dayOffset);
    const key = date.toISOString().slice(0, 10);
    availableByDay.set(key, availabilityForDay(date, preferences, events));
  }

  const suggestions: PlannerSuggestion[] = [];

  for (const candidate of candidates) {
    const chunks = chunkTaskMinutes(candidate.minutes, preferences.maxSessionMinutes);
    const dueAt = candidate.occurrence.dueAt ? parseISO(candidate.occurrence.dueAt) : undefined;

    for (const chunkMinutes of chunks) {
      let scheduled = false;

      for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
        const date = addDays(startOfDay(startDate), dayOffset);
        const key = date.toISOString().slice(0, 10);
        const dayAvailable = availableByDay.get(key) ?? [];

        const assignment = assignChunk(dayAvailable, chunkMinutes, dueAt);
        availableByDay.set(key, assignment.updated);

        if (!assignment.start || !assignment.end) {
          continue;
        }

        suggestions.push({
          id: createUuid(),
          taskId: candidate.task.id,
          occurrenceId: candidate.occurrence.id,
          title: candidate.task.title,
          start: assignment.start.toISOString(),
          end: assignment.end.toISOString(),
          minutes: chunkMinutes,
          source: 'heuristic',
          note: dueAt ? 'Scheduled before due date when possible.' : 'Scheduled in next available free slot.',
        });

        scheduled = true;
        break;
      }

      if (!scheduled) {
        break;
      }
    }
  }

  return suggestions.sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime());
}

function extractJsonArray(text: string): unknown[] | null {
  const trimmed = text.trim();

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']');
    if (start < 0 || end <= start) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

export async function generateAiPlannerSuggestions(input: {
  snapshot: TaskForgeSnapshot;
  apiKey: string;
  model?: string;
  startDate?: Date;
  days?: number;
}): Promise<PlannerSuggestion[] | null> {
  const startDate = input.startDate ?? new Date();
  const days = input.days ?? 7;
  const tasks = pendingCandidateTasks(input.snapshot).map((candidate) => ({
    taskId: candidate.task.id,
    occurrenceId: candidate.occurrence.id,
    title: candidate.task.title,
    dueAt: candidate.occurrence.dueAt,
    minutes: candidate.minutes,
    parentTaskId: candidate.task.parentTaskId,
  }));

  if (tasks.length === 0) {
    return [];
  }

  const payload = {
    schedule: input.snapshot.settings.planner,
    calendarEvents: input.snapshot.plannerCalendarEvents,
    windowStart: startDate.toISOString(),
    windowDays: days,
    tasks,
    constraints: {
      maxChunkMinutes: Math.min(input.snapshot.settings.planner.maxSessionMinutes, 90),
      avoidFatiguingBlocks: true,
      allowOverlap: true,
    },
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'You are a practical weekly planner. Return ONLY a JSON array. Each item must include taskId, occurrenceId, title, start, end, minutes, note. Keep chunks <= 90 minutes and prefer pre-deadline slots.',
        },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const parsedResponse = (await response.json()) as { output_text?: string };
  const outputText = parsedResponse.output_text ?? '';
  const array = extractJsonArray(outputText);

  if (!array) {
    return null;
  }

  const suggestions = array
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const taskId = typeof candidate.taskId === 'string' ? candidate.taskId : undefined;
      const occurrenceId = typeof candidate.occurrenceId === 'string' ? candidate.occurrenceId : undefined;
      const title = typeof candidate.title === 'string' ? candidate.title : undefined;
      const start = typeof candidate.start === 'string' ? candidate.start : undefined;
      const end = typeof candidate.end === 'string' ? candidate.end : undefined;
      const minutes = Number(candidate.minutes);

      if (!taskId || !title || !start || !end || Number.isNaN(minutes)) {
        return null;
      }

      return {
        id: createUuid(),
        taskId,
        occurrenceId,
        title,
        start,
        end,
        minutes: clamp(Math.round(minutes), 15, 90),
        source: 'ai' as const,
        note: typeof candidate.note === 'string' ? candidate.note : 'AI-assisted suggestion',
      };
    })
    .filter(Boolean) as PlannerSuggestion[];

  return suggestions;
}
