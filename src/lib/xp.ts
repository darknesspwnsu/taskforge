import { differenceInHours } from 'date-fns';

import type { AvatarStage, Task, TaskEffort } from '../types/domain';

export type XpBreakdown = {
  baseXp: number;
  timingFactor: number;
  streakMultiplier: number;
  awardedXp: number;
};

const BASE_XP_BY_EFFORT: Record<TaskEffort, number> = {
  quick: 20,
  normal: 40,
  deep: 70,
};

export function clampBaseXp(baseXp: number): number {
  return Math.max(10, Math.min(120, baseXp));
}

export function computeBaseXp(task: Pick<Task, 'manualXp' | 'effort' | 'dueAt'>, now: Date): number {
  if (typeof task.manualXp === 'number') {
    return clampBaseXp(task.manualXp);
  }

  let base = BASE_XP_BY_EFFORT[task.effort] ?? BASE_XP_BY_EFFORT.normal;

  if (task.dueAt) {
    const dueAt = new Date(task.dueAt);
    const hoursUntilDue = differenceInHours(dueAt, now);

    if (hoursUntilDue >= 0 && hoursUntilDue <= 24) {
      base += 10;
    }
  }

  return clampBaseXp(base);
}

export function computeTimingFactor(dueAt: Date | undefined, completedAt: Date): number {
  if (!dueAt) {
    return 1;
  }

  const millisEarly = dueAt.getTime() - completedAt.getTime();
  const millisLate = completedAt.getTime() - dueAt.getTime();
  const dayMillis = 24 * 60 * 60 * 1000;

  if (millisEarly > dayMillis) {
    return 1.25;
  }

  if (millisEarly >= 0) {
    return 1;
  }

  if (millisLate <= dayMillis) {
    return 0.5;
  }

  return 0;
}

export function streakMultiplier(streakDays: number): number {
  if (streakDays >= 14) {
    return 1.15;
  }

  if (streakDays >= 7) {
    return 1.1;
  }

  if (streakDays >= 3) {
    return 1.05;
  }

  return 1;
}

export function awardXp(input: {
  task: Pick<Task, 'manualXp' | 'effort' | 'dueAt'>;
  completedAt: Date;
  now?: Date;
  currentStreakDays: number;
}): XpBreakdown {
  const now = input.now ?? input.completedAt;
  const baseXp = computeBaseXp(input.task, now);
  const timingFactor = computeTimingFactor(
    input.task.dueAt ? new Date(input.task.dueAt) : undefined,
    input.completedAt,
  );
  const streak = streakMultiplier(input.currentStreakDays);
  const awardedXp = Math.max(0, Math.round(baseXp * timingFactor * streak));

  return {
    baseXp,
    timingFactor,
    streakMultiplier: streak,
    awardedXp,
  };
}

export function xpThresholdForLevel(level: number): number {
  if (level <= 1) {
    return 0;
  }

  return 25 * (level - 1) * (level + 2);
}

export function levelFromTotalXp(totalXp: number): number {
  if (totalXp <= 0) {
    return 1;
  }

  let level = 1;
  while (xpThresholdForLevel(level + 1) <= totalXp) {
    level += 1;
  }

  return level;
}

export function nextLevelDelta(level: number): number {
  return 100 + 50 * Math.max(level - 1, 0);
}

export function avatarStageFromLevel(level: number): AvatarStage {
  if (level >= 20) {
    return 4;
  }

  if (level >= 10) {
    return 3;
  }

  if (level >= 5) {
    return 2;
  }

  return 1;
}
