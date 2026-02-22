export type TaskEffort = 'quick' | 'normal' | 'deep';
export type TaskKind = 'standard' | 'complex_parent' | 'subtask';

export type OccurrenceStatus = 'pending' | 'completed' | 'skipped' | 'canceled';

export type RecurrenceRule =
  | {
      kind: 'interval_days';
      every: number;
    }
  | {
      kind: 'weekly';
      every: number;
      days: WeekdayCode[];
    };

export type WeekdayCode = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export type Task = {
  id: string;
  userId: string;
  title: string;
  notes?: string;
  effort: TaskEffort;
  taskKind?: TaskKind;
  parentTaskId?: string;
  estimatedMinutes?: number;
  dueAt?: string;
  manualXp?: number;
  recurrenceRule?: RecurrenceRule;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaskOccurrence = {
  id: string;
  taskId: string;
  userId: string;
  dueAt?: string;
  status: OccurrenceStatus;
  scheduledFor?: string;
  completedAt?: string;
  skippedAt?: string;
  skipReason?: string;
  occurrenceIndex: number;
};

export type XpLedgerEventType =
  | 'task_completed'
  | 'task_skipped'
  | 'manual_adjustment'
  | 'streak_bonus';

export type XpLedgerEvent = {
  id: string;
  userId: string;
  occurrenceId?: string;
  taskId?: string;
  clientActionId?: string;
  awardedXp: number;
  baseXp?: number;
  timingFactor?: number;
  streakMultiplier?: number;
  eventType: XpLedgerEventType;
  createdAt: string;
  note?: string;
};

export type UserProgress = {
  userId: string;
  totalXp: number;
  level: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastCompletedDate?: string;
  updatedAt: string;
};

export type AvatarStage = 1 | 2 | 3 | 4;

export type AvatarState = {
  userId: string;
  seed: string;
  stage: AvatarStage;
  updatedAt: string;
};

export type NotificationPreferences = {
  dueAtEnabled: boolean;
  oneHourBeforeEnabled: boolean;
  dailySummaryEnabled: boolean;
  dailySummaryHour: number;
};

export type TimeWindow = {
  start: string;
  end: string;
};

export type PlannerPreferences = {
  workWeekdays: TimeWindow[];
  sleepDaily: TimeWindow[];
  freeWeekdays: TimeWindow[];
  freeWeekends: TimeWindow[];
  maxSessionMinutes: number;
  autoUseAi: boolean;
  openAiApiKey?: string;
};

export type PlannerSuggestionSource = 'heuristic' | 'ai';

export type PlannerSuggestion = {
  id: string;
  taskId: string;
  occurrenceId?: string;
  title: string;
  start: string;
  end: string;
  minutes: number;
  source: PlannerSuggestionSource;
  note?: string;
};

export type PlannerCalendarEventSource = 'manual' | 'ics';

export type PlannerCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  source: PlannerCalendarEventSource;
};

export type AppSettings = {
  timezone: string;
  onboardingComplete: boolean;
  notifications: NotificationPreferences;
  planner: PlannerPreferences;
};

export type OfflineActionType =
  | 'create_task'
  | 'edit_task'
  | 'complete_occurrence'
  | 'skip_occurrence';

export type OfflineAction = {
  id: string;
  clientActionId: string;
  type: OfflineActionType;
  createdAt: string;
  payload: Record<string, unknown>;
  attempts: number;
  lastError?: string;
};
