import { describe, expect, it } from 'vitest';

import { heuristicXpRecommendation } from './xpSuggestion';

describe('heuristicXpRecommendation', () => {
  it('returns bounded XP and duration for typical task input', () => {
    const recommendation = heuristicXpRecommendation({
      title: 'Deep clean kitchen and carpets',
      effort: 'deep',
      notes: 'Lots of scrubbing and organizing',
      dueAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    });

    expect(recommendation.estimatedMinutes).toBeGreaterThanOrEqual(15);
    expect(recommendation.estimatedMinutes).toBeLessThanOrEqual(240);
    expect(recommendation.tediousness).toBeGreaterThanOrEqual(1);
    expect(recommendation.tediousness).toBeLessThanOrEqual(5);
    expect(recommendation.suggestedXp).toBeGreaterThanOrEqual(10);
    expect(recommendation.suggestedXp).toBeLessThanOrEqual(120);
  });

  it('prefers shorter estimates for quick tasks', () => {
    const quick = heuristicXpRecommendation({
      title: 'Take out trash',
      effort: 'quick',
    });

    const deep = heuristicXpRecommendation({
      title: 'Move apartments and deep clean',
      effort: 'deep',
    });

    expect(quick.estimatedMinutes).toBeLessThan(deep.estimatedMinutes);
    expect(quick.suggestedXp).toBeLessThan(deep.suggestedXp);
  });
});
