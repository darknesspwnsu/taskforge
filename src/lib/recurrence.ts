import { addDays, addWeeks, isAfter, subDays } from 'date-fns';

import { createUuid } from './id';
import type { Task, TaskOccurrence, WeekdayCode } from '../types/domain';

const DAY_CODE_TO_INDEX: Record<WeekdayCode, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

export function nextOccurrenceIndex(existing: TaskOccurrence[], taskId: string): number {
  const indexes = existing.filter((item) => item.taskId === taskId).map((item) => item.occurrenceIndex);

  return indexes.length === 0 ? 1 : Math.max(...indexes) + 1;
}

function utcStartOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDay(date: Date): string {
  return utcStartOfDay(date).toISOString();
}

function weeklyStartAnchor(anchor: Date): Date {
  const start = utcStartOfDay(anchor);
  return subDays(start, start.getUTCDay());
}

export function generateFutureOccurrences(input: {
  task: Task;
  existing: TaskOccurrence[];
  from: Date;
  horizonDays?: number;
}): TaskOccurrence[] {
  const { task, existing } = input;
  const horizonDays = input.horizonDays ?? 30;

  if (!task.recurrenceRule) {
    return [];
  }

  const from = utcStartOfDay(input.from);
  const until = addDays(from, horizonDays);
  const baseDate = task.dueAt
    ? utcStartOfDay(new Date(task.dueAt))
    : utcStartOfDay(new Date(task.createdAt));

  const existingByDay = new Set(
    existing
      .filter((item) => item.taskId === task.id && item.dueAt)
      .map((item) => isoDay(new Date(item.dueAt as string))),
  );

  const output: TaskOccurrence[] = [];
  let index = nextOccurrenceIndex(existing, task.id);

  if (task.recurrenceRule.kind === 'interval_days') {
    const interval = Math.max(task.recurrenceRule.every, 1);
    let cursor = baseDate;

    while (!isAfter(cursor, until)) {
      if (!isAfter(from, cursor)) {
        const dayKey = isoDay(cursor);

        if (!existingByDay.has(dayKey)) {
          output.push({
            id: createUuid(),
            taskId: task.id,
            userId: task.userId,
            dueAt: cursor.toISOString(),
            status: 'pending',
            occurrenceIndex: index,
          });
          existingByDay.add(dayKey);
          index += 1;
        }
      }

      cursor = addDays(cursor, interval);
    }

    return output;
  }

  const everyWeeks = Math.max(task.recurrenceRule.every, 1);
  const days = [...task.recurrenceRule.days].sort((a, b) => DAY_CODE_TO_INDEX[a] - DAY_CODE_TO_INDEX[b]);

  let cursorWeek = weeklyStartAnchor(baseDate);
  while (!isAfter(cursorWeek, until)) {
    for (const dayCode of days) {
      const dayOffset = DAY_CODE_TO_INDEX[dayCode];
      const dayDate = addDays(cursorWeek, dayOffset);

      if (isAfter(dayDate, until) || isAfter(from, dayDate)) {
        continue;
      }

      const dayKey = isoDay(dayDate);
      if (existingByDay.has(dayKey)) {
        continue;
      }

      output.push({
        id: createUuid(),
        taskId: task.id,
        userId: task.userId,
        dueAt: dayDate.toISOString(),
        status: 'pending',
        occurrenceIndex: index,
      });
      existingByDay.add(dayKey);
      index += 1;
    }

    cursorWeek = addWeeks(cursorWeek, everyWeeks);
  }

  return output;
}
