import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDueDate } from '../lib/format';
import { computeBaseXp } from '../lib/xp';
import { colors } from '../theme/colors';
import type { Task, TaskOccurrence } from '../types/domain';

export function OccurrenceCard({
  task,
  occurrence,
  onComplete,
  onSkip,
}: {
  task: Task;
  occurrence: TaskOccurrence;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const dueText = formatDueDate(occurrence.dueAt ?? task.dueAt);
  const baseXp = computeBaseXp(
    {
      effort: task.effort,
      manualXp: task.manualXp,
      dueAt: occurrence.dueAt ?? task.dueAt,
    },
    new Date(),
  );

  return (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <View style={styles.main}>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.meta}>
            {task.taskKind === 'subtask' ? 'Subtask · ' : ''}
            {dueText}
            {task.estimatedMinutes ? ` · ${task.estimatedMinutes} min` : ''}
          </Text>
        </View>
        <View style={styles.xpPill}>
          <Text style={styles.xpPillText}>{baseXp} XP</Text>
        </View>
      </View>

      {task.notes ? <Text style={styles.notes}>{task.notes}</Text> : null}

      <View style={styles.actions}>
        <Pressable style={[styles.actionButton, styles.completeButton]} onPress={onComplete}>
          <Text style={styles.completeText}>Complete</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.skipButton]} onPress={onSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  main: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  xpPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#D9F5F2',
  },
  xpPillText: {
    color: colors.brandDark,
    fontWeight: '800',
    fontSize: 12,
  },
  notes: {
    marginTop: 8,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  completeButton: {
    backgroundColor: colors.brand,
  },
  completeText: {
    color: 'white',
    fontWeight: '700',
  },
  skipButton: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
});
