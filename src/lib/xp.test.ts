import { describe, expect, it } from 'vitest';

import {
  avatarStageFromLevel,
  awardXp,
  computeBaseXp,
  computeTimingFactor,
  levelFromTotalXp,
  streakMultiplier,
  xpThresholdForLevel,
} from './xp';

describe('computeBaseXp', () => {
  const now = new Date('2026-02-22T00:00:00.000Z');

  it('uses manual XP when provided and clamps it', () => {
    expect(computeBaseXp({ manualXp: 400, effort: 'quick' }, now)).toBe(120);
    expect(computeBaseXp({ manualXp: 1, effort: 'deep' }, now)).toBe(10);
  });

  it('uses effort defaults and urgency bonus', () => {
    expect(computeBaseXp({ effort: 'quick' }, now)).toBe(20);
    expect(
      computeBaseXp(
        {
          effort: 'normal',
          dueAt: '2026-02-22T12:00:00.000Z',
        },
        now,
      ),
    ).toBe(50);
  });
});

describe('computeTimingFactor', () => {
  const dueAt = new Date('2026-02-25T10:00:00.000Z');

  it('returns 1.25 for tasks completed more than 24h early', () => {
    expect(computeTimingFactor(dueAt, new Date('2026-02-23T09:00:00.000Z'))).toBe(1.25);
  });

  it('returns 1 for on-time tasks', () => {
    expect(computeTimingFactor(dueAt, new Date('2026-02-25T10:00:00.000Z'))).toBe(1);
    expect(computeTimingFactor(dueAt, new Date('2026-02-24T10:00:00.000Z'))).toBe(1);
  });

  it('returns 0.5 for tasks late by up to 24h', () => {
    expect(computeTimingFactor(dueAt, new Date('2026-02-26T09:59:00.000Z'))).toBe(0.5);
  });

  it('returns 0 for tasks later than 24h late', () => {
    expect(computeTimingFactor(dueAt, new Date('2026-02-26T10:00:01.000Z'))).toBe(0);
  });

  it('returns 1 when no due date exists', () => {
    expect(computeTimingFactor(undefined, new Date('2026-02-22T10:00:00.000Z'))).toBe(1);
  });
});

describe('streakMultiplier', () => {
  it('matches defined buckets', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(3)).toBe(1.05);
    expect(streakMultiplier(7)).toBe(1.1);
    expect(streakMultiplier(14)).toBe(1.15);
  });
});

describe('awardXp', () => {
  it('calculates and rounds final XP award and never returns negative', () => {
    const breakdown = awardXp({
      task: {
        effort: 'normal',
        dueAt: '2026-02-24T00:00:00.000Z',
      },
      completedAt: new Date('2026-02-22T00:00:00.000Z'),
      now: new Date('2026-02-22T00:00:00.000Z'),
      currentStreakDays: 8,
    });

    expect(breakdown.baseXp).toBe(40);
    expect(breakdown.timingFactor).toBe(1.25);
    expect(breakdown.streakMultiplier).toBe(1.1);
    expect(breakdown.awardedXp).toBe(55);

    const veryLate = awardXp({
      task: {
        effort: 'deep',
        dueAt: '2026-02-20T00:00:00.000Z',
      },
      completedAt: new Date('2026-02-22T00:00:00.000Z'),
      currentStreakDays: 14,
    });

    expect(veryLate.awardedXp).toBe(0);
  });
});

describe('levels and avatar stages', () => {
  it('computes thresholds and levels from total XP', () => {
    expect(xpThresholdForLevel(1)).toBe(0);
    expect(xpThresholdForLevel(2)).toBe(100);
    expect(xpThresholdForLevel(3)).toBe(250);

    expect(levelFromTotalXp(0)).toBe(1);
    expect(levelFromTotalXp(100)).toBe(2);
    expect(levelFromTotalXp(249)).toBe(2);
    expect(levelFromTotalXp(250)).toBe(3);
  });

  it('maps avatar stage to level milestones', () => {
    expect(avatarStageFromLevel(1)).toBe(1);
    expect(avatarStageFromLevel(5)).toBe(2);
    expect(avatarStageFromLevel(10)).toBe(3);
    expect(avatarStageFromLevel(20)).toBe(4);
  });
});
