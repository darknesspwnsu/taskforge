import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { compareAsc, endOfDay, isAfter, isToday, parseISO } from 'date-fns';
import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

import type {
  NotificationPreferences,
  PlannerCalendarEvent,
  PlannerPreferences,
  PlannerSuggestion,
  TaskOccurrence,
} from '../types/domain';
import type { TaskForgeSnapshot } from '../types/state';
import { createDefaultSnapshot } from '../types/state';
import { createClientActionId } from '../lib/id';
import { fetchAndParseIcs } from '../lib/ics';
import {
  createCompleteActionPayload,
  createSkipActionPayload,
  enqueueOfflineAction,
  flushOfflineQueue,
} from '../lib/offlineQueue';
import { syncLocalReminderSchedules } from '../lib/localReminderScheduler';
import { generateAiPlannerSuggestions, generateHeuristicPlannerSuggestions } from '../lib/planner';
import {
  buildReminderFeed,
  createComplexTaskInSnapshot,
  completeOccurrenceInSnapshot,
  logRetroactiveCompletionInSnapshot,
  setPlannerCalendarEvents as applyPlannerCalendarEvents,
  setPlannerSuggestions,
  skipOccurrenceInSnapshot,
  syncRecurringOccurrences,
  updateSettings,
  upsertTaskInSnapshot,
  type ComplexSubtaskInput,
  type RetroactiveTaskInput,
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
  plannerSuggestions: PlannerSuggestion[];
  upsertTask: (input: UpsertTaskInput) => Promise<void>;
  completeOccurrence: (occurrenceId: string) => Promise<void>;
  skipOccurrence: (occurrenceId: string, reason?: string) => Promise<void>;
  logRetroactiveCompletion: (input: RetroactiveTaskInput) => Promise<void>;
  createComplexTask: (input: {
    title: string;
    notes?: string;
    dueAt?: string;
    estimatedMinutes?: number;
    subtasks: ComplexSubtaskInput[];
  }) => Promise<void>;
  setPlannerCalendarEvents: (events: PlannerCalendarEvent[]) => Promise<void>;
  importPlannerCalendarFromIcs: (icsUrl: string) => Promise<{ ok: boolean; message: string }>;
  generatePlannerSuggestions: (options?: { apiKey?: string; useAi?: boolean }) => Promise<void>;
  updatePlannerSettings: (preferences: Partial<PlannerPreferences>) => Promise<void>;
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

  const logRetroactiveCompletion = useCallback(
    async (input: RetroactiveTaskInput) => {
      if (!user) {
        return;
      }

      await persistNextSnapshot(queryClient, user.id, (current) => {
        const retroResult = logRetroactiveCompletionInSnapshot(current, user.id, input);
        let next = enqueueOfflineAction(retroResult.snapshot, {
          clientActionId: createClientActionId('create-retro-task'),
          type: 'create_task',
          payload: retroResult.task,
        });

        const completePayload = {
          occurrenceId: retroResult.occurrence.id,
          completedAt: retroResult.occurrence.completedAt,
          clientActionId: createClientActionId('complete-retro-task'),
        };

        next = enqueueOfflineAction(next, {
          clientActionId: String(completePayload.clientActionId),
          type: 'complete_occurrence',
          payload: completePayload,
        });

        return next;
      });
    },
    [queryClient, user],
  );

  const createComplexTask = useCallback(
    async (input: {
      title: string;
      notes?: string;
      dueAt?: string;
      estimatedMinutes?: number;
      subtasks: ComplexSubtaskInput[];
    }) => {
      if (!user || input.subtasks.length === 0) {
        return;
      }

      await persistNextSnapshot(queryClient, user.id, (current) => {
        const result = createComplexTaskInSnapshot(current, user.id, input, new Date());
        let next = result.snapshot;

        const queueTasks = [result.parentTask, ...result.subtasks];
        for (const queuedTask of queueTasks) {
          next = enqueueOfflineAction(next, {
            clientActionId: createClientActionId('create-complex-task'),
            type: 'create_task',
            payload: queuedTask,
          });
        }

        return next;
      });
    },
    [queryClient, user],
  );

  const setPlannerCalendarEvents = useCallback(
    async (events: PlannerCalendarEvent[]) => {
      if (!user) {
        return;
      }

      await persistNextSnapshot(queryClient, user.id, (current) => applyPlannerCalendarEvents(current, events));
    },
    [queryClient, user],
  );

  const importPlannerCalendarFromIcs = useCallback(
    async (icsUrl: string): Promise<{ ok: boolean; message: string }> => {
      if (!user) {
        return { ok: false, message: 'Missing user session.' };
      }

      const trimmed = icsUrl.trim();
      if (!trimmed) {
        return { ok: false, message: 'Enter a valid ICS URL.' };
      }

      try {
        const events = await fetchAndParseIcs(trimmed);
        await persistNextSnapshot(queryClient, user.id, (current) =>
          applyPlannerCalendarEvents(current, events),
        );
        return {
          ok: true,
          message: `Imported ${events.length} calendar events.`,
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Unable to import ICS feed.',
        };
      }
    },
    [queryClient, user],
  );

  const generatePlannerSuggestions = useCallback(
    async (options?: { apiKey?: string; useAi?: boolean }) => {
      if (!user) {
        return;
      }

      await persistNextSnapshot(queryClient, user.id, (current) => {
        const shouldUseAi = Boolean(
          (options?.useAi ?? current.settings.planner.autoUseAi) && options?.apiKey?.trim(),
        );

        if (!shouldUseAi) {
          const heuristic = generateHeuristicPlannerSuggestions({ snapshot: current });
          return setPlannerSuggestions(current, heuristic);
        }

        return current;
      });

      if (!(options?.useAi ?? false) || !options?.apiKey?.trim()) {
        return;
      }

      const key = queryKey(user.id);
      const latest = queryClient.getQueryData<TaskForgeSnapshot>(key);
      if (!latest) {
        return;
      }

      const aiSuggestions = await generateAiPlannerSuggestions({
        snapshot: latest,
        apiKey: options.apiKey.trim(),
      });

      if (!aiSuggestions) {
        return;
      }

      const next = setPlannerSuggestions(latest, aiSuggestions);
      queryClient.setQueryData(key, next);
      await saveSnapshot(user.id, next);
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

  const updatePlannerSettings = useCallback(
    async (preferences: Partial<PlannerPreferences>) => {
      if (!user) {
        return;
      }

      await persistNextSnapshot(queryClient, user.id, (current) =>
        updateSettings(current, {
          planner: {
            ...current.settings.planner,
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

  useEffect(() => {
    if (!user || !snapshotQuery.data) {
      return;
    }

    void syncLocalReminderSchedules(user.id, snapshotQuery.data);
  }, [snapshotQuery.data, user]);

  const snapshot = snapshotQuery.data ?? null;

  const derived = useMemo(() => {
    if (!snapshot) {
      return {
        todayOccurrences: [] as TaskOccurrence[],
        upcomingOccurrences: [] as TaskOccurrence[],
        reminderFeed: [] as TaskOccurrence[],
        plannerSuggestions: [] as PlannerSuggestion[],
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
        return isAfter(dueDate, endOfDay(new Date()));
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
      plannerSuggestions: snapshot.plannerSuggestions,
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
      logRetroactiveCompletion,
      createComplexTask,
      setPlannerCalendarEvents,
      importPlannerCalendarFromIcs,
      generatePlannerSuggestions,
      updatePlannerSettings,
      setOnboardingComplete,
      updateNotificationSettings,
      flushQueue,
    }),
    [
      derived,
      completeOccurrence,
      createComplexTask,
      flushQueue,
      generatePlannerSuggestions,
      importPlannerCalendarFromIcs,
      logRetroactiveCompletion,
      setOnboardingComplete,
      setPlannerCalendarEvents,
      skipOccurrence,
      snapshot,
      snapshotQuery.isPending,
      updatePlannerSettings,
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
