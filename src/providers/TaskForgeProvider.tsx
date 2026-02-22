import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { compareAsc, endOfDay, isBefore, isToday, parseISO, startOfDay } from 'date-fns';
import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

import type { NotificationPreferences, TaskOccurrence } from '../types/domain';
import type { TaskForgeSnapshot } from '../types/state';
import { createDefaultSnapshot } from '../types/state';
import { createClientActionId } from '../lib/id';
import {
  createCompleteActionPayload,
  createSkipActionPayload,
  enqueueOfflineAction,
  flushOfflineQueue,
} from '../lib/offlineQueue';
import {
  buildReminderFeed,
  completeOccurrenceInSnapshot,
  skipOccurrenceInSnapshot,
  syncRecurringOccurrences,
  updateSettings,
  upsertTaskInSnapshot,
  type UpsertTaskInput,
} from '../lib/taskEngine';
import { loadSnapshot, saveSnapshot } from '../lib/storage';
import { useAuth } from './AuthProvider';

type TaskForgeContextValue = {
  snapshot: TaskForgeSnapshot | null;
  loading: boolean;
  todayOccurrences: TaskOccurrence[];
  upcomingOccurrences: TaskOccurrence[];
  reminderFeed: TaskOccurrence[];
  upsertTask: (input: UpsertTaskInput) => Promise<void>;
  completeOccurrence: (occurrenceId: string) => Promise<void>;
  skipOccurrence: (occurrenceId: string, reason?: string) => Promise<void>;
  setOnboardingComplete: (completed: boolean) => Promise<void>;
  updateNotificationSettings: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  flushQueue: () => Promise<void>;
};

const TaskForgeContext = createContext<TaskForgeContextValue | undefined>(undefined);

function queryKey(userId: string | undefined) {
  return ['taskforge-snapshot', userId] as const;
}

function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

async function persistNextSnapshot(
  queryClient: QueryClient,
  userId: string,
  updater: (current: TaskForgeSnapshot) => TaskForgeSnapshot,
): Promise<TaskForgeSnapshot> {
  const key = queryKey(userId);
  const current = queryClient.getQueryData<TaskForgeSnapshot>(key) ?? createDefaultSnapshot(userId, getTimezone());
  const next = updater(current);
  queryClient.setQueryData(key, next);
  await saveSnapshot(userId, next);
  return next;
}

export function TaskForgeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const snapshotQuery = useQuery({
    queryKey: queryKey(user?.id),
    queryFn: async () => {
      if (!user) {
        throw new Error('Missing user for snapshot query');
      }

      const initial = await loadSnapshot(user.id, getTimezone());
      const synced = syncRecurringOccurrences(initial, new Date(), 30);
      await saveSnapshot(user.id, synced);
      return synced;
    },
    enabled: Boolean(user),
    staleTime: 2_000,
  });

  const upsertTask = useCallback(
    async (input: UpsertTaskInput) => {
      if (!user) {
        return;
      }

      await persistNextSnapshot(queryClient, user.id, (current) => {
        const { snapshot, task } = upsertTaskInSnapshot(current, user.id, input, new Date());

        return enqueueOfflineAction(snapshot, {
          clientActionId: createClientActionId(input.id ? 'edit-task' : 'create-task'),
          type: input.id ? 'edit_task' : 'create_task',
          payload: task,
        });
      });
    },
    [queryClient, user],
  );

  const completeOccurrence = useCallback(
    async (occurrenceId: string) => {
      if (!user) {
        return;
      }

      await persistNextSnapshot(queryClient, user.id, (current) => {
        const occurrence = current.occurrences.find((item) => item.id === occurrenceId);
        if (!occurrence) {
          return current;
        }

        const payload = createCompleteActionPayload(occurrence);
        const next = completeOccurrenceInSnapshot(current, {
          occurrenceId,
          completedAt: String(payload.completedAt),
          clientActionId: String(payload.clientActionId),
        }).snapshot;

        return enqueueOfflineAction(next, {
          clientActionId: String(payload.clientActionId),
          type: 'complete_occurrence',
          payload,
        });
      });
    },
    [queryClient, user],
  );

  const skipOccurrence = useCallback(
    async (occurrenceId: string, reason?: string) => {
      if (!user) {
        return;
      }

      await persistNextSnapshot(queryClient, user.id, (current) => {
        const occurrence = current.occurrences.find((item) => item.id === occurrenceId);
        if (!occurrence) {
          return current;
        }

        const payload = createSkipActionPayload(occurrence, reason);
        const next = skipOccurrenceInSnapshot(current, {
          occurrenceId,
          skippedAt: String(payload.skippedAt),
          reason: reason?.trim() || undefined,
          clientActionId: String(payload.clientActionId),
        }).snapshot;

        return enqueueOfflineAction(next, {
          clientActionId: String(payload.clientActionId),
          type: 'skip_occurrence',
          payload,
        });
      });
    },
    [queryClient, user],
  );

  const setOnboardingComplete = useCallback(
    async (completed: boolean) => {
      if (!user) {
        return;
      }

      await persistNextSnapshot(queryClient, user.id, (current) =>
        updateSettings(current, {
          onboardingComplete: completed,
        }),
      );
    },
    [queryClient, user],
  );

  const updateNotificationSettings = useCallback(
    async (preferences: Partial<NotificationPreferences>) => {
      if (!user) {
        return;
      }

      await persistNextSnapshot(queryClient, user.id, (current) =>
        updateSettings(current, {
          notifications: {
            ...current.settings.notifications,
            ...preferences,
          },
        }),
      );
    },
    [queryClient, user],
  );

  const flushQueue = useCallback(async () => {
    if (!user) {
      return;
    }

    const key = queryKey(user.id);
    const current = queryClient.getQueryData<TaskForgeSnapshot>(key);

    if (!current) {
      return;
    }

    const next = await flushOfflineQueue(current);
    queryClient.setQueryData(key, next);
    await saveSnapshot(user.id, next);
  }, [queryClient, user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const interval = setInterval(() => {
      void flushQueue();
    }, 15_000);

    return () => {
      clearInterval(interval);
    };
  }, [flushQueue, user]);

  const snapshot = snapshotQuery.data ?? null;

  const derived = useMemo(() => {
    if (!snapshot) {
      return {
        todayOccurrences: [] as TaskOccurrence[],
        upcomingOccurrences: [] as TaskOccurrence[],
        reminderFeed: [] as TaskOccurrence[],
      };
    }

    const pending = snapshot.occurrences.filter((item) => item.status === 'pending');

    const todayOccurrences = pending
      .filter((item) => !item.dueAt || isToday(parseISO(item.dueAt)))
      .sort((a, b) => {
        if (!a.dueAt || !b.dueAt) {
          return 0;
        }

        return compareAsc(parseISO(a.dueAt), parseISO(b.dueAt));
      });

    const upcomingOccurrences = pending
      .filter((item) => {
        if (!item.dueAt) {
          return false;
        }

        const dueDate = parseISO(item.dueAt);
        return isBefore(startOfDay(new Date()), dueDate) && isBefore(dueDate, endOfDay(parseISO('2100-01-01T00:00:00.000Z')));
      })
      .sort((a, b) => {
        if (!a.dueAt || !b.dueAt) {
          return 0;
        }

        return compareAsc(parseISO(a.dueAt), parseISO(b.dueAt));
      });

    return {
      todayOccurrences,
      upcomingOccurrences,
      reminderFeed: buildReminderFeed(snapshot),
    };
  }, [snapshot]);

  const value = useMemo<TaskForgeContextValue>(
    () => ({
      snapshot,
      loading: snapshotQuery.isPending,
      ...derived,
      upsertTask,
      completeOccurrence,
      skipOccurrence,
      setOnboardingComplete,
      updateNotificationSettings,
      flushQueue,
    }),
    [
      derived,
      completeOccurrence,
      flushQueue,
      setOnboardingComplete,
      skipOccurrence,
      snapshot,
      snapshotQuery.isPending,
      updateNotificationSettings,
      upsertTask,
    ],
  );

  return <TaskForgeContext.Provider value={value}>{children}</TaskForgeContext.Provider>;
}

export function useTaskForge(): TaskForgeContextValue {
  const context = useContext(TaskForgeContext);

  if (!context) {
    throw new Error('useTaskForge must be used inside TaskForgeProvider');
  }

  return context;
}
