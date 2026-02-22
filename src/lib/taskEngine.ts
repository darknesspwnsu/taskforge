import { addHours, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';

import type {
  AppSettings,
  OfflineAction,
  Task,
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
  dueAt?: string;
  manualXp?: number;
  recurrenceRule?: Task['recurrenceRule'];
  active?: boolean;
};

function ensurePendingOccurrence(task: Task, occurrences: TaskOccurrence[]): TaskOccurrence[] {
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

  if (!task.recurrenceRule) {
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
          status: 'completed',
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
          status: 'skipped',
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
  const oneHourAhead = addHours(now, 1);
  const oneDayAhead = addHours(now, 24);

  return snapshot.occurrences
    .filter((item) => item.status === 'pending')
    .filter((item) => {
      if (!item.dueAt) {
        return false;
      }

      const dueDate = parseISO(item.dueAt);
      return isBefore(dueDate, oneDayAhead) || isAfter(dueDate, oneHourAhead) || isBefore(dueDate, now);
    })
    .slice(0, 20);
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
    },
  };
}
