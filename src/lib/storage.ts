import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TaskForgeSnapshot } from '../types/state';
import { createDefaultSnapshot, createDefaultSettings } from '../types/state';

const SNAPSHOT_KEY_PREFIX = 'taskforge:v1:snapshot';

function snapshotKey(userId: string): string {
  return `${SNAPSHOT_KEY_PREFIX}:${userId}`;
}

function normalizeSnapshot(
  userId: string,
  timezone: string,
  candidate: Partial<TaskForgeSnapshot>,
): TaskForgeSnapshot {
  const base = createDefaultSnapshot(userId, timezone);
  const candidateSettings = candidate.settings ?? base.settings;

  return {
    ...base,
    ...candidate,
    settings: {
      ...createDefaultSettings(timezone),
      ...candidateSettings,
      notifications: {
        ...base.settings.notifications,
        ...(candidateSettings.notifications ?? {}),
      },
      planner: {
        ...base.settings.planner,
        ...(candidateSettings.planner ?? {}),
      },
    },
    tasks: (candidate.tasks ?? base.tasks).map((task) => ({
      ...task,
      taskKind: task.taskKind ?? 'standard',
    })),
    occurrences: candidate.occurrences ?? base.occurrences,
    xpLedger: candidate.xpLedger ?? base.xpLedger,
    offlineQueue: candidate.offlineQueue ?? base.offlineQueue,
    plannerSuggestions: candidate.plannerSuggestions ?? base.plannerSuggestions,
    plannerCalendarEvents: candidate.plannerCalendarEvents ?? base.plannerCalendarEvents,
  };
}

export async function loadSnapshot(userId: string, timezone: string): Promise<TaskForgeSnapshot> {
  const serialized = await AsyncStorage.getItem(snapshotKey(userId));

  if (!serialized) {
    return createDefaultSnapshot(userId, timezone);
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<TaskForgeSnapshot>;
    return normalizeSnapshot(userId, timezone, parsed);
  } catch (error) {
    console.warn('Unable to parse local snapshot, restoring defaults', error);
    return createDefaultSnapshot(userId, timezone);
  }
}

export async function saveSnapshot(userId: string, snapshot: TaskForgeSnapshot): Promise<void> {
  await AsyncStorage.setItem(snapshotKey(userId), JSON.stringify(snapshot));
}
