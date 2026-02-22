import type {
  AppSettings,
  AvatarState,
  OfflineAction,
  Task,
  TaskOccurrence,
  UserProgress,
  XpLedgerEvent,
} from './domain';

export type TaskForgeSnapshot = {
  tasks: Task[];
  occurrences: TaskOccurrence[];
  xpLedger: XpLedgerEvent[];
  progress: UserProgress;
  avatar: AvatarState;
  settings: AppSettings;
  offlineQueue: OfflineAction[];
  lastSyncedAt?: string;
};

export type AuthUser = {
  id: string;
  email?: string;
};

export function createDefaultSettings(timezone: string): AppSettings {
  return {
    timezone,
    onboardingComplete: false,
    notifications: {
      dueAtEnabled: true,
      oneHourBeforeEnabled: true,
      dailySummaryEnabled: false,
      dailySummaryHour: 8,
    },
  };
}

export function createDefaultSnapshot(userId: string, timezone: string): TaskForgeSnapshot {
  const nowIso = new Date().toISOString();

  return {
    tasks: [],
    occurrences: [],
    xpLedger: [],
    progress: {
      userId,
      totalXp: 0,
      level: 1,
      currentStreakDays: 0,
      longestStreakDays: 0,
      updatedAt: nowIso,
    },
    avatar: {
      userId,
      seed: userId.slice(0, 8),
      stage: 1,
      updatedAt: nowIso,
    },
    settings: createDefaultSettings(timezone),
    offlineQueue: [],
  };
}
