import { addHours, isBefore, parseISO, startOfDay } from 'date-fns';

import type {
  AppSettings,
  OfflineAction,
  PlannerCalendarEvent,
  PlannerSuggestion,
  Task,
  TaskKind,
  TaskOccurrence,
  UserProgress,
  XpLedgerEvent,
} from '../types/domain';
import type { TaskForgeSnapshot } from '../types/state';
import { createUuid } from './id';
import { generateFutureOccurrences, nextOccurrenceIndex } from './recurrence';
import { avatarStageFromLevel, awardXp, levelFromTotalXp } from './xp';

export type UpsertTaskInput = {
  id?: string;
  title: string;
  notes?: string;
  effort: Task['effort'];
  taskKind?: TaskKind;
  parentTaskId?: string;
  estimatedMinutes?: number;
  dueAt?: string;
  manualXp?: number;
  recurrenceRule?: Task['recurrenceRule'];
  active?: boolean;
};

function ensurePendingOccurrence(task: Task, occurrences: TaskOccurrence[]): TaskOccurrence[] {
  if (task.taskKind === 'complex_parent') {
    return occurrences;
  }

  const hasPending = occurrences.some((item) => item.taskId === task.id && item.status === 'pending');
  if (hasPending) {
    return occurrences;
  }

  const index = nextOccurrenceIndex(occurrences, task.id);
  return [
    ...occurrences,
    {
      id: createUuid(),
      taskId: task.id,
      userId: task.userId,
      dueAt: task.dueAt,
      status: 'pending',
      occurrenceIndex: index,
    },
  ];
}

function sortOccurrences(occurrences: TaskOccurrence[]): TaskOccurrence[] {
  return [...occurrences].sort((a, b) => {
    const left = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const right = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;

    return left - right;
  });
}

export function upsertTaskInSnapshot(
  snapshot: TaskForgeSnapshot,
  userId: string,
  input: UpsertTaskInput,
  now = new Date(),
): { snapshot: TaskForgeSnapshot; task: Task } {
  const nowIso = now.toISOString();
  const existing = input.id ? snapshot.tasks.find((task) => task.id === input.id) : undefined;

  const task: Task = {
    id: existing?.id ?? createUuid(),
    userId,
    title: input.title.trim(),
    notes: input.notes?.trim() || undefined,
    effort: input.effort,
    taskKind: input.taskKind ?? existing?.taskKind ?? 'standard',
    parentTaskId: input.parentTaskId ?? existing?.parentTaskId,
    estimatedMinutes: input.estimatedMinutes ?? existing?.estimatedMinutes,
    dueAt: input.dueAt,
    manualXp: input.manualXp,
    recurrenceRule: input.recurrenceRule,
    active: input.active ?? true,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };

  const tasks = existing
    ? snapshot.tasks.map((item) => (item.id === task.id ? task : item))
    : [...snapshot.tasks, task];

  let occurrences = snapshot.occurrences;

  if (task.taskKind === 'complex_parent') {
    occurrences = occurrences.filter((item) => item.taskId !== task.id || item.status !== 'pending');
  } else if (!task.recurrenceRule) {
    occurrences = occurrences.filter(
      (item) => item.taskId !== task.id || item.status !== 'pending' || !item.dueAt,
    );
    occurrences = ensurePendingOccurrence(task, occurrences);
  } else {
    const nonPending = occurrences.filter((item) => !(item.taskId === task.id && item.status === 'pending'));
    const generated = generateFutureOccurrences({
      task,
      existing: nonPending,
      from: now,
      horizonDays: 30,
    });
    occurrences = [...nonPending, ...generated];
  }

  return {
    snapshot: {
      ...snapshot,
      tasks,
      occurrences: sortOccurrences(occurrences),
    },
    task,
  };
}

function incrementStreak(progress: UserProgress, completedAt: Date): number {
  const day = startOfDay(completedAt);
  const lastDay = progress.lastCompletedDate ? startOfDay(parseISO(progress.lastCompletedDate)) : undefined;

  if (!lastDay) {
    return 1;
  }

  if (day.getTime() === lastDay.getTime()) {
    return progress.currentStreakDays;
  }

  const previousDay = startOfDay(addHours(day, -24));
  if (previousDay.getTime() === lastDay.getTime()) {
    return progress.currentStreakDays + 1;
  }

  return 1;
}

export function completeOccurrenceInSnapshot(
  snapshot: TaskForgeSnapshot,
  input: {
    occurrenceId: string;
    completedAt: string;
    clientActionId: string;
  },
): {
  snapshot: TaskForgeSnapshot;
  event?: XpLedgerEvent;
} {
  const occurrence = snapshot.occurrences.find((item) => item.id === input.occurrenceId);
  if (!occurrence || occurrence.status !== 'pending') {
    return { snapshot };
  }

  const task = snapshot.tasks.find((item) => item.id === occurrence.taskId);
  if (!task) {
    return { snapshot };
  }

  const completedAt = parseISO(input.completedAt);
  const nextStreakDays = incrementStreak(snapshot.progress, completedAt);
  const xp = awardXp({
    task,
    completedAt,
    now: completedAt,
    currentStreakDays: nextStreakDays,
  });

  const totalXp = snapshot.progress.totalXp + xp.awardedXp;
  const level = levelFromTotalXp(totalXp);

  const event: XpLedgerEvent = {
    id: createUuid(),
    userId: task.userId,
    occurrenceId: occurrence.id,
    taskId: task.id,
    clientActionId: input.clientActionId,
    eventType: 'task_completed',
    awardedXp: xp.awardedXp,
    baseXp: xp.baseXp,
    timingFactor: xp.timingFactor,
    streakMultiplier: xp.streakMultiplier,
    createdAt: input.completedAt,
  };

  const occurrences = snapshot.occurrences.map((item) =>
    item.id === occurrence.id
      ? {
          ...item,
          status: 'completed' as const,
          completedAt: input.completedAt,
        }
      : item,
  );

  return {
    snapshot: {
      ...snapshot,
      occurrences,
      xpLedger: [event, ...snapshot.xpLedger].slice(0, 200),
      progress: {
        ...snapshot.progress,
        totalXp,
        level,
        currentStreakDays: nextStreakDays,
        longestStreakDays: Math.max(snapshot.progress.longestStreakDays, nextStreakDays),
        lastCompletedDate: completedAt.toISOString(),
        updatedAt: input.completedAt,
      },
      avatar: {
        ...snapshot.avatar,
        stage: avatarStageFromLevel(level),
        updatedAt: input.completedAt,
      },
    },
    event,
  };
}

export function skipOccurrenceInSnapshot(
  snapshot: TaskForgeSnapshot,
  input: {
    occurrenceId: string;
    skippedAt: string;
    reason?: string;
    clientActionId: string;
  },
): {
  snapshot: TaskForgeSnapshot;
  event?: XpLedgerEvent;
} {
  const occurrence = snapshot.occurrences.find((item) => item.id === input.occurrenceId);
  if (!occurrence || occurrence.status !== 'pending') {
    return { snapshot };
  }

  const task = snapshot.tasks.find((item) => item.id === occurrence.taskId);
  if (!task) {
    return { snapshot };
  }

  const event: XpLedgerEvent = {
    id: createUuid(),
    userId: task.userId,
    occurrenceId: occurrence.id,
    taskId: task.id,
    clientActionId: input.clientActionId,
    eventType: 'task_skipped',
    awardedXp: 0,
    createdAt: input.skippedAt,
    note: input.reason,
  };

  const occurrences = snapshot.occurrences.map((item) =>
    item.id === occurrence.id
      ? {
          ...item,
          status: 'skipped' as const,
          skippedAt: input.skippedAt,
          skipReason: input.reason,
        }
      : item,
  );

  return {
    snapshot: {
      ...snapshot,
      occurrences,
      xpLedger: [event, ...snapshot.xpLedger].slice(0, 200),
    },
    event,
  };
}

export type RetroactiveTaskInput = {
  title: string;
  notes?: string;
  effort: Task['effort'];
  manualXp?: number;
  dueAt?: string;
  completedAt: string;
  estimatedMinutes?: number;
};

export function logRetroactiveCompletionInSnapshot(
  snapshot: TaskForgeSnapshot,
  userId: string,
  input: RetroactiveTaskInput,
): { snapshot: TaskForgeSnapshot; task: Task; occurrence: TaskOccurrence } {
  const normalizedCompletedAt = parseISO(input.completedAt).toISOString();
  const nowIso = new Date().toISOString();

  const task: Task = {
    id: createUuid(),
    userId,
    title: input.title.trim(),
    notes: input.notes?.trim() || undefined,
    effort: input.effort,
    taskKind: 'standard',
    dueAt: input.dueAt,
    estimatedMinutes: input.estimatedMinutes,
    manualXp: input.manualXp,
    active: true,
    createdAt: normalizedCompletedAt,
    updatedAt: nowIso,
  };

  const occurrence: TaskOccurrence = {
    id: createUuid(),
    taskId: task.id,
    userId,
    dueAt: input.dueAt ?? normalizedCompletedAt,
    status: 'completed',
    completedAt: normalizedCompletedAt,
    occurrenceIndex: nextOccurrenceIndex(snapshot.occurrences, task.id),
  };

  const xp = awardXp({
    task,
    completedAt: parseISO(normalizedCompletedAt),
    now: parseISO(normalizedCompletedAt),
    currentStreakDays: 0,
  });
  const totalXp = snapshot.progress.totalXp + xp.awardedXp;
  const level = levelFromTotalXp(totalXp);

  const event: XpLedgerEvent = {
    id: createUuid(),
    userId,
    occurrenceId: occurrence.id,
    taskId: task.id,
    eventType: 'task_completed',
    awardedXp: xp.awardedXp,
    baseXp: xp.baseXp,
    timingFactor: xp.timingFactor,
    streakMultiplier: xp.streakMultiplier,
    createdAt: normalizedCompletedAt,
    note: 'Retroactive completion',
  };

  const hadLastCompleted = Boolean(snapshot.progress.lastCompletedDate);
  const previousLastCompleted = snapshot.progress.lastCompletedDate
    ? parseISO(snapshot.progress.lastCompletedDate)
    : undefined;
  const nextLastCompleted =
    !previousLastCompleted || parseISO(normalizedCompletedAt) > previousLastCompleted
      ? normalizedCompletedAt
      : snapshot.progress.lastCompletedDate;

  return {
    task,
    occurrence,
    snapshot: {
      ...snapshot,
      tasks: [task, ...snapshot.tasks],
      occurrences: sortOccurrences([occurrence, ...snapshot.occurrences]),
      xpLedger: [event, ...snapshot.xpLedger].slice(0, 200),
      progress: {
        ...snapshot.progress,
        totalXp,
        level,
        currentStreakDays: hadLastCompleted ? snapshot.progress.currentStreakDays : 1,
        longestStreakDays: Math.max(snapshot.progress.longestStreakDays, hadLastCompleted ? snapshot.progress.currentStreakDays : 1),
        lastCompletedDate: nextLastCompleted,
        updatedAt: nowIso,
      },
      avatar: {
        ...snapshot.avatar,
        stage: avatarStageFromLevel(level),
        updatedAt: nowIso,
      },
    },
  };
}

export type ComplexSubtaskInput = {
  title: string;
  notes?: string;
  effort?: Task['effort'];
  dueAt?: string;
  manualXp?: number;
  estimatedMinutes?: number;
};

export type CreateComplexTaskInput = {
  title: string;
  notes?: string;
  dueAt?: string;
  estimatedMinutes?: number;
  subtasks: ComplexSubtaskInput[];
};

function distributedSubtaskDueDate(
  parentDueAt: string | undefined,
  index: number,
  total: number,
  now: Date,
): string | undefined {
  if (!parentDueAt) {
    return undefined;
  }

  const end = parseISO(parentDueAt).getTime();
  const start = now.getTime();
  if (end <= start) {
    return parentDueAt;
  }

  const step = (end - start) / Math.max(total + 1, 1);
  return new Date(start + step * (index + 1)).toISOString();
}

export function createComplexTaskInSnapshot(
  snapshot: TaskForgeSnapshot,
  userId: string,
  input: CreateComplexTaskInput,
  now = new Date(),
): { snapshot: TaskForgeSnapshot; parentTask: Task; subtasks: Task[] } {
  const nowIso = now.toISOString();
  const parentTask: Task = {
    id: createUuid(),
    userId,
    title: input.title.trim(),
    notes: input.notes?.trim() || undefined,
    effort: 'normal',
    taskKind: 'complex_parent',
    dueAt: input.dueAt,
    estimatedMinutes: input.estimatedMinutes,
    active: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const subtasks: Task[] = [];
  const occurrences: TaskOccurrence[] = [...snapshot.occurrences];

  for (const [index, subtaskInput] of input.subtasks.entries()) {
    const subtaskDueAt =
      subtaskInput.dueAt || distributedSubtaskDueDate(input.dueAt, index, input.subtasks.length, now);
    const subtask: Task = {
      id: createUuid(),
      userId,
      title: subtaskInput.title.trim(),
      notes: subtaskInput.notes?.trim() || undefined,
      effort: subtaskInput.effort ?? 'normal',
      taskKind: 'subtask',
      parentTaskId: parentTask.id,
      dueAt: subtaskDueAt,
      manualXp: subtaskInput.manualXp,
      estimatedMinutes: subtaskInput.estimatedMinutes,
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const occurrence: TaskOccurrence = {
      id: createUuid(),
      taskId: subtask.id,
      userId,
      dueAt: subtaskDueAt,
      status: 'pending',
      occurrenceIndex: nextOccurrenceIndex(occurrences, subtask.id),
    };

    subtasks.push(subtask);
    occurrences.push(occurrence);
  }

  return {
    parentTask,
    subtasks,
    snapshot: {
      ...snapshot,
      tasks: [parentTask, ...subtasks, ...snapshot.tasks],
      occurrences: sortOccurrences(occurrences),
    },
  };
}

export function getComplexTaskProgress(snapshot: TaskForgeSnapshot, parentTaskId: string): {
  total: number;
  completed: number;
  pending: number;
} {
  const subtasks = snapshot.tasks.filter((task) => task.parentTaskId === parentTaskId);
  const completed = subtasks.filter((subtask) =>
    snapshot.occurrences.some(
      (occurrence) => occurrence.taskId === subtask.id && occurrence.status === 'completed',
    ),
  ).length;

  return {
    total: subtasks.length,
    completed,
    pending: Math.max(subtasks.length - completed, 0),
  };
}

export function syncRecurringOccurrences(
  snapshot: TaskForgeSnapshot,
  now = new Date(),
  horizonDays = 30,
): TaskForgeSnapshot {
  let occurrences = snapshot.occurrences;

  for (const task of snapshot.tasks) {
    if (!task.active || !task.recurrenceRule) {
      continue;
    }

    const generated = generateFutureOccurrences({
      task,
      existing: occurrences,
      from: now,
      horizonDays,
    });

    occurrences = [...occurrences, ...generated];
  }

  return {
    ...snapshot,
    occurrences: sortOccurrences(occurrences),
  };
}

export function buildReminderFeed(snapshot: TaskForgeSnapshot, now = new Date()): TaskOccurrence[] {
  const oneDayAhead = addHours(now, 24);

  return snapshot.occurrences
    .filter((item) => item.status === 'pending')
    .filter((item) => {
      if (!item.dueAt) {
        return false;
      }

      const dueDate = parseISO(item.dueAt);
      return isBefore(dueDate, oneDayAhead);
    })
    .sort((a, b) => {
      if (!a.dueAt || !b.dueAt) {
        return 0;
      }

      return parseISO(a.dueAt).getTime() - parseISO(b.dueAt).getTime();
    })
    .slice(0, 20);
}

export function setPlannerSuggestions(
  snapshot: TaskForgeSnapshot,
  suggestions: PlannerSuggestion[],
): TaskForgeSnapshot {
  return {
    ...snapshot,
    plannerSuggestions: suggestions.slice(0, 300),
  };
}

export function setPlannerCalendarEvents(
  snapshot: TaskForgeSnapshot,
  events: PlannerCalendarEvent[],
): TaskForgeSnapshot {
  return {
    ...snapshot,
    plannerCalendarEvents: events.slice(0, 500),
  };
}

export function dequeueAction(queue: OfflineAction[], actionId: string): OfflineAction[] {
  return queue.filter((item) => item.id !== actionId);
}

export function updateSettings(snapshot: TaskForgeSnapshot, settings: Partial<AppSettings>): TaskForgeSnapshot {
  return {
    ...snapshot,
    settings: {
      ...snapshot.settings,
      ...settings,
      notifications: {
        ...snapshot.settings.notifications,
        ...(settings.notifications ?? {}),
      },
      planner: {
        ...snapshot.settings.planner,
        ...(settings.planner ?? {}),
      },
    },
  };
}
