import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../src/components/PrimaryButton';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { useTaskForge } from '../src/hooks/useTaskForge';
import { colors } from '../src/theme/colors';
import type { TaskEffort } from '../src/types/domain';

const EFFORTS: TaskEffort[] = ['quick', 'normal', 'deep'];

export default function RetroLogScreen() {
  const router = useRouter();
  const { logRetroactiveCompletion } = useTaskForge();

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [effort, setEffort] = useState<TaskEffort>('normal');
  const [completedAt, setCompletedAt] = useState(yesterday);
  const [dueAt, setDueAt] = useState('');
  const [manualXp, setManualXp] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('60');
  const [saving, setSaving] = useState(false);

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
        <Text style={styles.label}>Task title</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Got car washed" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Notes (optional)</Text>
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
          <Pressable onPress={() => setCompletedAt(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())} style={styles.miniButton}>
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
});
