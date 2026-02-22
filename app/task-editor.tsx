import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../src/components/PrimaryButton';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { useTaskForge } from '../src/hooks/useTaskForge';
import { colors } from '../src/theme/colors';
import type { TaskEffort } from '../src/types/domain';

const EFFORTS: TaskEffort[] = ['quick', 'normal', 'deep'];

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

  const save = async () => {
    const parsedXp = manualXp.trim() ? Number(manualXp) : undefined;

    await upsertTask({
      id: editingTask?.id,
      title,
      notes,
      effort,
      manualXp: Number.isFinite(parsedXp) ? parsedXp : undefined,
      dueAt: editingTask?.dueAt,
      recurrenceRule: editingTask?.recurrenceRule,
      active: editingTask?.active ?? true,
    });

    router.back();
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>{editingTask ? 'Edit Task' : 'Create Task'}</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Task title" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
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
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
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
  },
  chipTextSelected: {
    color: colors.brandDark,
  },
});
