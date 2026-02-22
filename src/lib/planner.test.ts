import { describe, expect, it } from 'vitest';

import { createDefaultSnapshot } from '../types/state';
import type { Task, TaskOccurrence } from '../types/domain';
import { chunkTaskMinutes, estimateTaskMinutes, generateHeuristicPlannerSuggestions } from './planner';

describe('planner utilities', () => {
  it('estimates task duration with sensible defaults', () => {
    expect(estimateTaskMinutes({ effort: 'quick' })).toBe(30);
    expect(estimateTaskMinutes({ effort: 'normal' })).toBe(60);
    expect(estimateTaskMinutes({ effort: 'deep' })).toBe(90);
    expect(estimateTaskMinutes({ effort: 'normal', estimatedMinutes: 140 })).toBe(140);
  });

  it('chunks long tasks into <= 90 minute sessions', () => {
    const chunks = chunkTaskMinutes(220, 90);
    expect(chunks.every((chunk) => chunk <= 90)).toBe(true);
    expect(chunks.reduce((sum, value) => sum + value, 0)).toBe(220);
  });

  it('generates heuristic suggestions from pending tasks and availability', () => {
    const snapshot = createDefaultSnapshot('user-1', 'UTC');

    const task: Task = {
      id: 'task-1',
      userId: 'user-1',
      title: 'Deep clean carpets',
      effort: 'deep',
      estimatedMinutes: 120,
      dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const occurrence: TaskOccurrence = {
      id: 'occ-1',
      taskId: task.id,
      userId: task.userId,
      dueAt: task.dueAt,
      status: 'pending',
      occurrenceIndex: 1,
    };

    snapshot.tasks = [task];
    snapshot.occurrences = [occurrence];

    const suggestions = generateHeuristicPlannerSuggestions({
      snapshot,
      startDate: new Date(),
      days: 3,
    });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((item) => item.minutes <= 90)).toBe(true);
    expect(suggestions[0]?.taskId).toBe(task.id);
  });
});
