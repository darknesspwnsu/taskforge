import { differenceInHours } from 'date-fns';

import type { TaskEffort } from '../types/domain';

export type XpRecommendationSource = 'heuristic' | 'ai';

export type XpRecommendation = {
  estimatedMinutes: number;
  tediousness: number;
  suggestedXp: number;
  rationale: string;
  source: XpRecommendationSource;
};

type XpRecommendationInput = {
  title: string;
  notes?: string;
  effort: TaskEffort;
  dueAt?: string;
  estimatedMinutes?: number;
  apiKey?: string;
  model?: string;
};

const TEDIOUS_KEYWORDS = [
  'clean',
  'deep clean',
  'laundry',
  'dishes',
  'trash',
  'paperwork',
  'tax',
  'organize',
  'declutter',
  'move',
  'apartment',
  'unpack',
  'carpet',
  'maintenance',
  'insurance',
  'bank',
  'admin',
  'manual',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

function keywordMatches(text: string): number {
  const normalized = text.toLowerCase();
  return TEDIOUS_KEYWORDS.reduce((count, keyword) => (normalized.includes(keyword) ? count + 1 : count), 0);
}

function defaultMinutesByEffort(effort: TaskEffort): number {
  if (effort === 'quick') {
    return 30;
  }

  if (effort === 'deep') {
    return 90;
  }

  return 60;
}

function effortBonus(effort: TaskEffort): number {
  if (effort === 'quick') {
    return 4;
  }

  if (effort === 'deep') {
    return 18;
  }

  return 10;
}

export function heuristicXpRecommendation(input: {
  title: string;
  notes?: string;
  effort: TaskEffort;
  dueAt?: string;
  estimatedMinutes?: number;
}): XpRecommendation {
  const text = `${input.title} ${input.notes ?? ''}`.trim();
  const keywordScore = keywordMatches(text);

  const baseMinutes =
    typeof input.estimatedMinutes === 'number' && input.estimatedMinutes > 0
      ? input.estimatedMinutes
      : defaultMinutesByEffort(input.effort) + keywordScore * 10;

  const estimatedMinutes = clamp(Math.round(baseMinutes), 15, 240);

  let tediousness = input.effort === 'quick' ? 2 : input.effort === 'deep' ? 4 : 3;
  if (keywordScore >= 2) {
    tediousness += 1;
  }
  if (estimatedMinutes >= 120) {
    tediousness += 1;
  }
  tediousness = clamp(tediousness, 1, 5);

  const timeComponent = Math.ceil(estimatedMinutes / 15) * 5;
  const tediousComponent = (tediousness - 1) * 8;
  const urgencyComponent =
    input.dueAt && differenceInHours(new Date(input.dueAt), new Date()) <= 24 ? 8 : 0;

  const suggestedXp = clamp(
    Math.round(timeComponent + tediousComponent + effortBonus(input.effort) + urgencyComponent),
    10,
    120,
  );

  return {
    estimatedMinutes,
    tediousness,
    suggestedXp,
    rationale:
      'Heuristic estimate from effort, likely duration, tediousness cues, and deadline urgency.',
    source: 'heuristic',
  };
}

export async function suggestXpRecommendation(
  input: XpRecommendationInput,
): Promise<XpRecommendation> {
  const heuristic = heuristicXpRecommendation(input);
  const apiKey = input.apiKey?.trim();

  if (!apiKey) {
    return heuristic;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: input.model ?? 'gpt-4.1-mini',
        temperature: 0.2,
        input: [
          {
            role: 'system',
            content:
              'You estimate task XP for a gamified todo app. Return only JSON with keys estimatedMinutes, tediousness, suggestedXp, rationale. Constraints: estimatedMinutes 15-240, tediousness 1-5, suggestedXp 10-120.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: {
                title: input.title,
                notes: input.notes ?? '',
                effort: input.effort,
                dueAt: input.dueAt,
                estimatedMinutes: input.estimatedMinutes,
              },
              guidance: {
                scrumLikeWeighting: true,
                scoreHigherForTediousOrLongTasks: true,
              },
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return heuristic;
    }

    const payload = (await response.json()) as { output_text?: string };
    const parsed = parseJsonObject(payload.output_text ?? '');
    if (!parsed) {
      return heuristic;
    }

    const estimatedMinutes = clamp(Math.round(Number(parsed.estimatedMinutes)), 15, 240);
    const tediousness = clamp(Math.round(Number(parsed.tediousness)), 1, 5);
    const suggestedXp = clamp(Math.round(Number(parsed.suggestedXp)), 10, 120);

    if ([estimatedMinutes, tediousness, suggestedXp].some((value) => Number.isNaN(value))) {
      return heuristic;
    }

    return {
      estimatedMinutes,
      tediousness,
      suggestedXp,
      rationale:
        typeof parsed.rationale === 'string' && parsed.rationale.trim().length > 0
          ? parsed.rationale
          : 'AI estimate based on task complexity and expected effort.',
      source: 'ai',
    };
  } catch {
    return heuristic;
  }
}
