import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../src/components/PrimaryButton';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { VoiceDictationButton } from '../src/components/VoiceDictationButton';
import { useTaskForge } from '../src/hooks/useTaskForge';
import { suggestXpRecommendation, type XpRecommendation } from '../src/lib/xpSuggestion';
import { colors } from '../src/theme/colors';
import type { TaskEffort } from '../src/types/domain';

const EFFORTS: TaskEffort[] = ['quick', 'normal', 'deep'];
const EFFORT_GUIDE = 'Quick: ~30m / 20 XP · Normal: ~60m / 40 XP · Deep: ~90m / 70 XP';

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

export default function RetroLogScreen() {
  const router = useRouter();
  const { snapshot, logRetroactiveCompletion } = useTaskForge();

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [effort, setEffort] = useState<TaskEffort>('normal');
  const [completedAt, setCompletedAt] = useState(yesterday);
  const [dueAt, setDueAt] = useState('');
  const [manualXp, setManualXp] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('60');
  const [saving, setSaving] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState('');
  const [recommendation, setRecommendation] = useState<XpRecommendation | null>(null);

  const plannerApiKey = snapshot?.settings.planner.openAiApiKey?.trim() || '';

  const recommendRetroXp = async () => {
    if (!title.trim()) {
      setAssistantMessage('Enter a task title before requesting XP recommendation.');
      return;
    }

    setRecommending(true);

    const parsedEstimated = estimatedMinutes.trim() ? Number(estimatedMinutes) : undefined;
    const result = await suggestXpRecommendation({
      title,
      notes,
      effort,
      dueAt: dueAt.trim() || undefined,
      estimatedMinutes: Number.isFinite(parsedEstimated) ? parsedEstimated : undefined,
      apiKey: plannerApiKey || undefined,
    });

    setRecommendation(result);
    setManualXp(String(result.suggestedXp));
    setEstimatedMinutes(String(result.estimatedMinutes));
    setAssistantMessage(
      result.source === 'ai'
        ? 'AI recommendation applied to XP and estimated minutes.'
        : 'Heuristic recommendation applied. Add OpenAI key in Planner for AI mode.',
    );
    setRecommending(false);
  };

  const saveRetro = async () => {
    setSaving(true);
    const parsedManualXp = manualXp.trim() ? Number(manualXp) : undefined;
    const parsedEstimated = estimatedMinutes.trim() ? Number(estimatedMinutes) : undefined;

    await logRetroactiveCompletion({
      title,
      notes,
      effort,
      completedAt,
      dueAt: dueAt.trim() || undefined,
      manualXp: Number.isFinite(parsedManualXp) ? parsedManualXp : undefined,
      estimatedMinutes: Number.isFinite(parsedEstimated) ? parsedEstimated : undefined,
    });

    setSaving(false);
    router.back();
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Retroactive Credit</Text>
      <Text style={styles.subtitle}>Log work you already completed to get XP credit.</Text>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Task title</Text>
          <VoiceDictationButton
            onTranscript={(spoken) => setTitle((previous) => appendText(previous, spoken))}
            onError={setAssistantMessage}
          />
        </View>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Got car washed" />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Notes (optional)</Text>
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
          placeholder="Any details"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Effort</Text>
        <View style={styles.rowWrap}>
          {EFFORTS.map((item) => {
            const selected = effort === item;
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
        <Text style={styles.label}>Completed at (ISO)</Text>
        <TextInput
          value={completedAt}
          onChangeText={setCompletedAt}
          style={styles.input}
          placeholder="2026-02-21T18:30:00Z"
        />
        <View style={styles.rowWrap}>
          <Pressable onPress={() => setCompletedAt(new Date().toISOString())} style={styles.miniButton}>
            <Text style={styles.miniButtonText}>Now</Text>
          </Pressable>
          <Pressable
            onPress={() => setCompletedAt(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())}
            style={styles.miniButton}>
            <Text style={styles.miniButtonText}>Yesterday</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Due at (optional ISO)</Text>
        <TextInput
          value={dueAt}
          onChangeText={setDueAt}
          style={styles.input}
          placeholder="2026-02-22T10:00:00Z"
        />
      </View>

      <View style={styles.assistantCard}>
        <Text style={styles.assistantTitle}>XP Assistant</Text>
        <Text style={styles.assistantText}>
          {plannerApiKey
            ? 'Uses your saved OpenAI key to estimate XP for this retro task.'
            : 'Uses heuristic fallback. Add OpenAI key in Planner for AI recommendations.'}
        </Text>
        <PrimaryButton
          label={plannerApiKey ? 'Recommend XP (AI)' : 'Recommend XP (Heuristic)'}
          onPress={recommendRetroXp}
          loading={recommending}
          disabled={!title.trim()}
        />
        {recommendation ? (
          <View style={styles.assistantResult}>
            <Text style={styles.assistantResultText}>
              Suggested XP: {recommendation.suggestedXp} · Est. time: {recommendation.estimatedMinutes}m
            </Text>
            <Text style={styles.assistantReason}>{recommendation.rationale}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Estimated minutes</Text>
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
          placeholder="45"
        />
      </View>

      {assistantMessage ? <Text style={styles.message}>{assistantMessage}</Text> : null}

      <PrimaryButton label="Log Completion" onPress={saveRetro} disabled={!title.trim()} loading={saving} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 14,
    fontSize: 14,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 5,
    fontSize: 12,
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
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  effortGuide: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceMuted,
  },
  chipSelected: {
    borderColor: colors.brand,
    backgroundColor: '#D9F5F2',
  },
  chipText: {
    color: colors.textSecondary,
    textTransform: 'capitalize',
    fontWeight: '700',
    fontSize: 12,
  },
  chipTextSelected: {
    color: colors.brandDark,
  },
  miniButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  miniButtonText: {
    color: colors.brandDark,
    fontWeight: '700',
    fontSize: 12,
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
