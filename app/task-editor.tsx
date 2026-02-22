import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../src/components/PrimaryButton';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { VoiceDictationButton } from '../src/components/VoiceDictationButton';
import { useTaskForge } from '../src/hooks/useTaskForge';
import { suggestXpRecommendation, type XpRecommendation } from '../src/lib/xpSuggestion';
import { colors } from '../src/theme/colors';
import type { RecurrenceRule, TaskEffort, WeekdayCode } from '../src/types/domain';

const EFFORTS: TaskEffort[] = ['quick', 'normal', 'deep'];
const EFFORT_GUIDE = 'Quick: ~30m / 20 XP · Normal: ~60m / 40 XP · Deep: ~90m / 70 XP';
const WEEKDAYS: WeekdayCode[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function normalizeDueInput(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function appendText(previous: string, spoken: string): string {
  const left = previous.trim();
  const right = spoken.trim();

  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return `${left} ${right}`.replace(/\s+/g, ' ').trim();
}

export default function TaskEditorModal() {
  const router = useRouter();
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const { snapshot, upsertTask } = useTaskForge();

  const editingTask = useMemo(
    () => snapshot?.tasks.find((item) => item.id === taskId),
    [snapshot?.tasks, taskId],
  );

  const [title, setTitle] = useState(editingTask?.title ?? '');
  const [notes, setNotes] = useState(editingTask?.notes ?? '');
  const [effort, setEffort] = useState<TaskEffort>(editingTask?.effort ?? 'normal');
  const [manualXp, setManualXp] = useState(editingTask?.manualXp ? String(editingTask.manualXp) : '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    editingTask?.estimatedMinutes ? String(editingTask.estimatedMinutes) : '',
  );
  const [dueInput, setDueInput] = useState(editingTask?.dueAt ? editingTask.dueAt : '');
  const [assistantMessage, setAssistantMessage] = useState('');
  const [xpRecommendation, setXpRecommendation] = useState<XpRecommendation | null>(null);
  const [recommendingXp, setRecommendingXp] = useState(false);

  const plannerApiKey = snapshot?.settings.planner.openAiApiKey?.trim() || '';

  const [recurrenceKind, setRecurrenceKind] = useState<'none' | 'interval_days' | 'weekly'>(
    editingTask?.recurrenceRule?.kind ?? 'none',
  );
  const [intervalEvery, setIntervalEvery] = useState(
    editingTask?.recurrenceRule?.kind === 'interval_days'
      ? String(editingTask.recurrenceRule.every)
      : '3',
  );
  const [weeklyEvery, setWeeklyEvery] = useState(
    editingTask?.recurrenceRule?.kind === 'weekly' ? String(editingTask.recurrenceRule.every) : '1',
  );
  const [weeklyDays, setWeeklyDays] = useState<WeekdayCode[]>(
    editingTask?.recurrenceRule?.kind === 'weekly' ? editingTask.recurrenceRule.days : ['MO', 'WE', 'FR'],
  );

  const toggleWeekday = (weekday: WeekdayCode) => {
    setWeeklyDays((current) =>
      current.includes(weekday) ? current.filter((day) => day !== weekday) : [...current, weekday],
    );
  };

  const recommendXp = async () => {
    if (!title.trim()) {
      setAssistantMessage('Enter a task title first so XP can be estimated.');
      return;
    }

    setRecommendingXp(true);
    const parsedEstimatedMinutes = estimatedMinutes.trim() ? Number(estimatedMinutes) : undefined;

    const recommendation = await suggestXpRecommendation({
      title,
      notes,
      effort,
      dueAt: normalizeDueInput(dueInput),
      estimatedMinutes: Number.isFinite(parsedEstimatedMinutes) ? parsedEstimatedMinutes : undefined,
      apiKey: plannerApiKey || undefined,
    });

    setXpRecommendation(recommendation);
    setManualXp(String(recommendation.suggestedXp));
    setEstimatedMinutes(String(recommendation.estimatedMinutes));
    setAssistantMessage(
      recommendation.source === 'ai'
        ? 'AI recommendation applied to XP and estimated minutes.'
        : 'Heuristic recommendation applied. Add an OpenAI key in Planner to enable AI mode.',
    );
    setRecommendingXp(false);
  };

  const save = async () => {
    const parsedXp = manualXp.trim() ? Number(manualXp) : undefined;
    const parsedEstimatedMinutes = estimatedMinutes.trim() ? Number(estimatedMinutes) : undefined;
    const dueAt = normalizeDueInput(dueInput);

    let recurrenceRule: RecurrenceRule | undefined;

    if (recurrenceKind === 'interval_days') {
      recurrenceRule = {
        kind: 'interval_days',
        every: Math.max(Number(intervalEvery) || 1, 1),
      };
    }

    if (recurrenceKind === 'weekly') {
      recurrenceRule = {
        kind: 'weekly',
        every: Math.max(Number(weeklyEvery) || 1, 1),
        days: weeklyDays.length > 0 ? weeklyDays : ['MO'],
      };
    }

    await upsertTask({
      id: editingTask?.id,
      title,
      notes,
      effort,
      manualXp: Number.isFinite(parsedXp) ? parsedXp : undefined,
      estimatedMinutes: Number.isFinite(parsedEstimatedMinutes) ? parsedEstimatedMinutes : undefined,
      dueAt,
      recurrenceRule,
      active: editingTask?.active ?? true,
    });

    router.back();
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>{editingTask ? 'Edit Task' : 'Create Task'}</Text>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Title</Text>
          <VoiceDictationButton
            onTranscript={(spoken) => setTitle((previous) => appendText(previous, spoken))}
            onError={setAssistantMessage}
          />
        </View>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Task title" />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Notes</Text>
          <VoiceDictationButton
            onTranscript={(spoken) => setNotes((previous) => appendText(previous, spoken))}
            onError={setAssistantMessage}
          />
        </View>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, styles.textarea]}
          multiline
          placeholder="Optional details"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Effort</Text>
        <View style={styles.row}>
          {EFFORTS.map((item) => {
            const selected = item === effort;
            return (
              <Pressable
                key={item}
                onPress={() => setEffort(item)}
                style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.effortGuide}>{EFFORT_GUIDE}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Due date/time (ISO, optional)</Text>
        <TextInput
          value={dueInput}
          onChangeText={setDueInput}
          style={styles.input}
          placeholder="2026-03-01T18:30:00Z"
        />
        <View style={styles.rowWrap}>
          <Pressable
            onPress={() => setDueInput(new Date(Date.now() + 60 * 60 * 1000).toISOString())}
            style={styles.miniLinkButton}>
            <Text style={styles.miniLinkText}>In 1 hour</Text>
          </Pressable>
          <Pressable
            onPress={() => setDueInput(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())}
            style={styles.miniLinkButton}>
            <Text style={styles.miniLinkText}>In 24 hours</Text>
          </Pressable>
          <Pressable onPress={() => setDueInput('')} style={styles.miniLinkButton}>
            <Text style={styles.miniLinkText}>Clear</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Recurrence</Text>
        <View style={styles.rowWrap}>
          {(['none', 'interval_days', 'weekly'] as const).map((kind) => {
            const selected = recurrenceKind === kind;
            const label = kind === 'none' ? 'None' : kind === 'interval_days' ? 'Every N days' : 'Weekly';
            return (
              <Pressable
                key={kind}
                onPress={() => setRecurrenceKind(kind)}
                style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {recurrenceKind === 'interval_days' ? (
          <TextInput
            value={intervalEvery}
            onChangeText={setIntervalEvery}
            keyboardType="number-pad"
            style={[styles.input, styles.marginTop]}
            placeholder="Every N days (e.g. 3)"
          />
        ) : null}

        {recurrenceKind === 'weekly' ? (
          <View style={styles.weeklySection}>
            <TextInput
              value={weeklyEvery}
              onChangeText={setWeeklyEvery}
              keyboardType="number-pad"
              style={styles.input}
              placeholder="Every N weeks (e.g. 1)"
            />
            <View style={styles.rowWrap}>
              {WEEKDAYS.map((day) => {
                const selected = weeklyDays.includes(day);
                return (
                  <Pressable
                    key={day}
                    onPress={() => toggleWeekday(day)}
                    style={[styles.dayChip, selected && styles.chipSelected]}>
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.assistantCard}>
        <Text style={styles.assistantTitle}>XP Assistant</Text>
        <Text style={styles.assistantText}>
          {plannerApiKey
            ? 'Uses your saved OpenAI key to estimate tediousness, time, and XP.'
            : 'Uses heuristic fallback. Add an OpenAI key in Planner for AI-based estimates.'}
        </Text>

        <PrimaryButton
          label={plannerApiKey ? 'Recommend XP (AI)' : 'Recommend XP (Heuristic)'}
          onPress={recommendXp}
          loading={recommendingXp}
          disabled={!title.trim()}
        />

        {xpRecommendation ? (
          <View style={styles.assistantResult}>
            <Text style={styles.assistantResultText}>
              Suggested XP: {xpRecommendation.suggestedXp} · Est. time: {xpRecommendation.estimatedMinutes}m · Tediousness: {xpRecommendation.tediousness}/5
            </Text>
            <Text style={styles.assistantReason}>{xpRecommendation.rationale}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Estimated minutes (optional)</Text>
        <TextInput
          value={estimatedMinutes}
          onChangeText={setEstimatedMinutes}
          keyboardType="number-pad"
          style={styles.input}
          placeholder="60"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Manual XP (optional)</Text>
        <TextInput
          value={manualXp}
          onChangeText={setManualXp}
          keyboardType="number-pad"
          style={styles.input}
          placeholder="Ex: 45"
        />
      </View>

      {assistantMessage ? <Text style={styles.message}>{assistantMessage}</Text> : null}

      <PrimaryButton label="Save Task" onPress={save} disabled={!title.trim()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
  },
  textarea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  effortGuide: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.surfaceMuted,
  },
  dayChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceMuted,
  },
  chipSelected: {
    borderColor: colors.brand,
    backgroundColor: '#D9F5F2',
  },
  chipText: {
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'capitalize',
    fontSize: 12,
  },
  chipTextSelected: {
    color: colors.brandDark,
  },
  miniLinkButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  miniLinkText: {
    color: colors.brandDark,
    fontWeight: '700',
    fontSize: 12,
  },
  marginTop: {
    marginTop: 8,
  },
  weeklySection: {
    gap: 8,
    marginTop: 8,
  },
  assistantCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  assistantTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  assistantText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  assistantResult: {
    borderRadius: 10,
    padding: 8,
    backgroundColor: colors.surfaceMuted,
  },
  assistantResultText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  assistantReason: {
    color: colors.textSecondary,
    marginTop: 5,
    fontSize: 12,
  },
  message: {
    color: colors.brandDark,
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
});
