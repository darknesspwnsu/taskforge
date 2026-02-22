import { describe, expect, it } from 'vitest';

import { createDefaultSnapshot } from '../types/state';
import {
  createComplexTaskInSnapshot,
  getComplexTaskProgress,
  logRetroactiveCompletionInSnapshot,
} from './taskEngine';

describe('logRetroactiveCompletionInSnapshot', () => {
  it('creates a completed task occurrence and awards XP', () => {
    const snapshot = createDefaultSnapshot('user-1', 'UTC');

    const result = logRetroactiveCompletionInSnapshot(snapshot, 'user-1', {
      title: 'Got car washed',
      effort: 'normal',
      completedAt: '2026-02-21T12:00:00.000Z',
    });

    expect(result.snapshot.tasks.length).toBe(1);
    expect(result.snapshot.occurrences[0]?.status).toBe('completed');
    expect(result.snapshot.xpLedger[0]?.awardedXp).toBeGreaterThan(0);
    expect(result.snapshot.progress.totalXp).toBeGreaterThan(0);
  });
});

describe('createComplexTaskInSnapshot', () => {
  it('creates a complex parent with subtask tasks and pending occurrences', () => {
    const snapshot = createDefaultSnapshot('user-1', 'UTC');

    const result = createComplexTaskInSnapshot(snapshot, 'user-1', {
      title: 'Move apartments',
      dueAt: '2026-03-01T18:00:00.000Z',
      subtasks: [
        { title: 'Pack kitchen', effort: 'normal' },
        { title: 'Book movers', effort: 'quick' },
      ],
    });

    expect(result.parentTask.taskKind).toBe('complex_parent');
    expect(result.subtasks).toHaveLength(2);
    expect(result.subtasks.every((task) => task.parentTaskId === result.parentTask.id)).toBe(true);

    const progress = getComplexTaskProgress(result.snapshot, result.parentTask.id);
    expect(progress.total).toBe(2);
    expect(progress.completed).toBe(0);
    expect(progress.pending).toBe(2);
  });
});
