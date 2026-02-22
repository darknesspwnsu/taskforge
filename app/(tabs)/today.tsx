import { Link } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AvatarLevelCard } from '../../src/components/AvatarLevelCard';
import { GroupedOccurrenceList } from '../../src/components/GroupedOccurrenceList';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { VoiceDictationButton } from '../../src/components/VoiceDictationButton';
import { useTaskForge } from '../../src/hooks/useTaskForge';
import { getComplexTaskProgress } from '../../src/lib/taskEngine';
import { xpThresholdForLevel } from '../../src/lib/xp';
import { colors } from '../../src/theme/colors';
import type { TaskEffort } from '../../src/types/domain';

const EFFORTS: TaskEffort[] = ['quick', 'normal', 'deep'];

type DuePreset = 'none' | '1h' | '24h';
const EFFORT_LEGEND = 'Quick: ~30m / 20 XP · Normal: ~60m / 40 XP · Deep: ~90m / 70 XP';

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

export default function TodayScreen() {
  const { snapshot, todayOccurrences, reminderFeed, upsertTask, completeOccurrence, skipOccurrence } = useTaskForge();

  const [title, setTitle] = useState('');
  const [effort, setEffort] = useState<TaskEffort>('normal');
  const [duePreset, setDuePreset] = useState<DuePreset>('none');
  const [quickMessage, setQuickMessage] = useState('');

  const nextLevelThreshold = useMemo(() => {
    if (!snapshot) {
      return 100;
    }

    return xpThresholdForLevel(snapshot.progress.level + 1);
  }, [snapshot]);

  const currentLevelThreshold = useMemo(() => {
    if (!snapshot) {
      return 0;
    }

    return xpThresholdForLevel(snapshot.progress.level);
  }, [snapshot]);

  const progressToNext = useMemo(() => {
    if (!snapshot) {
      return 0;
    }

    const denominator = Math.max(nextLevelThreshold - currentLevelThreshold, 1);
    return (snapshot.progress.totalXp - currentLevelThreshold) / denominator;
  }, [currentLevelThreshold, nextLevelThreshold, snapshot]);

  const taskById = useMemo(
    () => new Map((snapshot?.tasks ?? []).map((task) => [task.id, task])),
    [snapshot?.tasks],
  );
  const complexParents = useMemo(
    () => (snapshot?.tasks ?? []).filter((task) => task.taskKind === 'complex_parent'),
    [snapshot?.tasks],
  );

  const createQuickTask = async () => {
    if (!title.trim()) {
      setQuickMessage('Enter a task title first.');
      return;
    }

    const now = new Date();
    const dueAt =
      duePreset === '1h'
        ? new Date(now.getTime() + 60 * 60 * 1000).toISOString()
        : duePreset === '24h'
          ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
          : undefined;

    await upsertTask({
      title,
      effort,
      dueAt,
      recurrenceRule: undefined,
    });

    setTitle('');
    setDuePreset('none');
    setQuickMessage('');
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.subtitle}>Move fast. Complete tasks early for bonus XP.</Text>

      {snapshot ? (
        <AvatarLevelCard
          level={snapshot.progress.level}
          totalXp={snapshot.progress.totalXp}
          currentStreak={snapshot.progress.currentStreakDays}
          stage={snapshot.avatar.stage}
          progressToNext={progressToNext}
        />
      ) : null}

      <View style={styles.quickAddCard}>
        <Text style={styles.sectionTitle}>Quick add</Text>
        <View style={styles.quickInputLabelRow}>
          <Text style={styles.quickInputLabel}>Task title</Text>
          <VoiceDictationButton
            onTranscript={(spoken) => setTitle((previous) => appendText(previous, spoken))}
            onError={setQuickMessage}
          />
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What needs to get done?"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

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
        <Text style={styles.effortLegend}>{EFFORT_LEGEND}</Text>

        <View style={styles.rowWrap}>
          {(['none', '1h', '24h'] as DuePreset[]).map((preset) => {
            const selected = duePreset === preset;
            const label = preset === 'none' ? 'No deadline' : preset === '1h' ? 'Due in 1h' : 'Due in 24h';
            return (
              <Pressable
                key={preset}
                onPress={() => setDuePreset(preset)}
                style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton label="Add Task" onPress={createQuickTask} disabled={!title.trim()} />
        {quickMessage ? <Text style={styles.quickMessage}>{quickMessage}</Text> : null}
        <View style={styles.quickLinks}>
          <Link href="/task-editor" style={styles.openEditorLink}>
            Open full editor
          </Link>
          <Link href="/retro-log" style={styles.openEditorLink}>
            Log completed task
          </Link>
          <Link href="/complex-task" style={styles.openEditorLink}>
            Create complex task
          </Link>
          <Link href="/(tabs)/planner" style={styles.openEditorLink}>
            Open planner
          </Link>
        </View>
      </View>

      {complexParents.length > 0 ? <Text style={styles.sectionTitle}>Complex Objectives</Text> : null}
      {complexParents.map((parent) => {
        const progress = getComplexTaskProgress(snapshot!, parent.id);
        const completion = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

        return (
          <View key={`complex-${parent.id}`} style={styles.feedItem}>
            <Text style={styles.feedTitle}>{parent.title}</Text>
            <Text style={styles.feedMeta}>
              {progress.completed}/{progress.total} subtasks complete ({completion}%)
            </Text>
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Due now</Text>
      <GroupedOccurrenceList
        snapshot={snapshot}
        occurrences={todayOccurrences}
        emptyText="No pending tasks for today."
        onComplete={(occurrenceId) => void completeOccurrence(occurrenceId)}
        onSkip={(occurrenceId) => void skipOccurrence(occurrenceId)}
      />

      <Text style={styles.sectionTitle}>Reminder feed</Text>
      {reminderFeed.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>You are clear for now.</Text>
        </View>
      ) : (
        reminderFeed.map((occurrence) => {
          const task = taskById.get(occurrence.taskId);
          if (!task) {
            return null;
          }

          return (
            <View style={styles.feedItem} key={`feed-${occurrence.id}`}>
              <Text style={styles.feedTitle}>{task.title}</Text>
              <Text style={styles.feedMeta}>{occurrence.dueAt ? new Date(occurrence.dueAt).toLocaleString() : 'No deadline'}</Text>
            </View>
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 12,
    fontSize: 14,
  },
  quickAddCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 8,
  },
  quickInputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickInputLabel: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
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
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  effortLegend: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
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
    backgroundColor: '#D9F5F2',
    borderColor: colors.brand,
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
  openEditorLink: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 13,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  quickLinks: {
    marginTop: 4,
    gap: 2,
  },
  quickMessage: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  feedItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  feedTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  feedMeta: {
    color: colors.textSecondary,
    marginTop: 4,
    fontSize: 12,
  },
});
