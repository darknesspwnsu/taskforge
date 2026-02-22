import { describe, expect, it } from 'vitest';

import type { Task } from '../types/domain';
import { generateFutureOccurrences } from './recurrence';

function taskFixture(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    userId: 'user-1',
    title: 'Test Task',
    effort: 'normal',
    active: true,
    createdAt: '2026-02-20T00:00:00.000Z',
    updatedAt: '2026-02-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('generateFutureOccurrences', () => {
  it('generates interval recurrence occurrences without duplicating existing ones', () => {
    const task = taskFixture({
      dueAt: '2026-02-20T00:00:00.000Z',
      recurrenceRule: {
        kind: 'interval_days',
        every: 3,
      },
    });

    const results = generateFutureOccurrences({
      task,
      existing: [
        {
          id: 'occ-existing',
          taskId: task.id,
          userId: task.userId,
          dueAt: '2026-02-23T00:00:00.000Z',
          status: 'pending',
          occurrenceIndex: 1,
        },
      ],
      from: new Date('2026-02-22T00:00:00.000Z'),
      horizonDays: 8,
    });

    expect(results.map((item) => item.dueAt)).toEqual([
      '2026-02-26T00:00:00.000Z',
      '2026-03-01T00:00:00.000Z',
    ]);
  });

  it('generates weekly recurrence based on selected weekdays', () => {
    const task = taskFixture({
      dueAt: '2026-02-22T00:00:00.000Z',
      recurrenceRule: {
        kind: 'weekly',
        every: 1,
        days: ['MO', 'WE'],
      },
    });

    const results = generateFutureOccurrences({
      task,
      existing: [],
      from: new Date('2026-02-22T00:00:00.000Z'),
      horizonDays: 10,
    });

    expect(results.map((item) => item.dueAt)).toEqual([
      '2026-02-23T00:00:00.000Z',
      '2026-02-25T00:00:00.000Z',
      '2026-03-02T00:00:00.000Z',
      '2026-03-04T00:00:00.000Z',
    ]);
  });
});
