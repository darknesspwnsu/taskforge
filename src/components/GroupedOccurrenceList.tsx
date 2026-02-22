import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getComplexTaskProgress } from '../lib/taskEngine';
import { colors } from '../theme/colors';
import type { Task, TaskOccurrence } from '../types/domain';
import type { TaskForgeSnapshot } from '../types/state';
import { OccurrenceCard } from './OccurrenceCard';

type GroupedOccurrenceListProps = {
  snapshot: TaskForgeSnapshot | null;
  occurrences: TaskOccurrence[];
  emptyText: string;
  onComplete: (occurrenceId: string) => void;
  onSkip: (occurrenceId: string) => void;
};

type GroupedEntry = {
  parentTask: Task;
  entries: Array<{ occurrence: TaskOccurrence; task: Task }>;
};

type RenderItem =
  | { kind: 'group'; id: string; sortValue: number; group: GroupedEntry }
  | { kind: 'single'; id: string; sortValue: number; occurrence: TaskOccurrence; task: Task };

function dueSortValue(occurrence: TaskOccurrence): number {
  return occurrence.dueAt ? new Date(occurrence.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
}

export function GroupedOccurrenceList({
  snapshot,
  occurrences,
  emptyText,
  onComplete,
  onSkip,
}: GroupedOccurrenceListProps) {
  const [expandedByParentId, setExpandedByParentId] = useState<Record<string, boolean>>({});

  const renderItems = useMemo<RenderItem[]>(() => {
    if (!snapshot) {
      return [];
    }

    const taskById = new Map(snapshot.tasks.map((task) => [task.id, task]));
    const groupedByParentId = new Map<string, GroupedEntry>();
    const singles: Array<{ occurrence: TaskOccurrence; task: Task }> = [];

    for (const occurrence of occurrences) {
      const task = taskById.get(occurrence.taskId);
      if (!task) {
        continue;
      }

      if (task.taskKind === 'subtask' && task.parentTaskId) {
        const parentTask = taskById.get(task.parentTaskId);
        if (parentTask?.taskKind === 'complex_parent') {
          const existing = groupedByParentId.get(parentTask.id);
          if (!existing) {
            groupedByParentId.set(parentTask.id, {
              parentTask,
              entries: [{ occurrence, task }],
            });
          } else {
            existing.entries.push({ occurrence, task });
          }
          continue;
        }
      }

      singles.push({ occurrence, task });
    }

    const items: RenderItem[] = [];

    for (const [parentId, group] of groupedByParentId.entries()) {
      const sortedEntries = [...group.entries].sort(
        (left, right) => dueSortValue(left.occurrence) - dueSortValue(right.occurrence),
      );

      items.push({
        kind: 'group',
        id: `group-${parentId}`,
        sortValue: sortedEntries[0] ? dueSortValue(sortedEntries[0].occurrence) : Number.MAX_SAFE_INTEGER,
        group: {
          parentTask: group.parentTask,
          entries: sortedEntries,
        },
      });
    }

    for (const entry of singles) {
      items.push({
        kind: 'single',
        id: entry.occurrence.id,
        sortValue: dueSortValue(entry.occurrence),
        occurrence: entry.occurrence,
        task: entry.task,
      });
    }

    return items.sort((left, right) => {
      if (left.sortValue !== right.sortValue) {
        return left.sortValue - right.sortValue;
      }

      return left.id.localeCompare(right.id);
    });
  }, [occurrences, snapshot]);

  if (renderItems.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View>
      {renderItems.map((item) => {
        if (item.kind === 'single') {
          return (
            <OccurrenceCard
              key={item.id}
              occurrence={item.occurrence}
              task={item.task}
              onComplete={() => onComplete(item.occurrence.id)}
              onSkip={() => onSkip(item.occurrence.id)}
            />
          );
        }

        const group = item.group;
        const expanded = expandedByParentId[group.parentTask.id] ?? false;
        const nearestDueAt = group.entries[0]?.occurrence.dueAt;
        const nearestDueText = nearestDueAt
          ? new Date(nearestDueAt).toLocaleString()
          : 'No deadline';
        const progress = snapshot ? getComplexTaskProgress(snapshot, group.parentTask.id) : null;
        const completedText = progress
          ? `${progress.completed}/${progress.total} subtasks complete`
          : `${group.entries.length} subtasks`;

        return (
          <View key={item.id} style={styles.groupBlock}>
            <Pressable
              style={styles.groupCard}
              onPress={() =>
                setExpandedByParentId((previous) => ({
                  ...previous,
                  [group.parentTask.id]: !expanded,
                }))
              }>
              <View style={styles.groupHeader}>
                <View style={styles.groupMain}>
                  <Text style={styles.groupTitle}>{group.parentTask.title}</Text>
                  <Text style={styles.groupMeta}>
                    {completedText} · {group.entries.length} pending
                  </Text>
                  <Text style={styles.groupMeta}>Nearest due: {nearestDueText}</Text>
                </View>
                <View style={styles.expandPill}>
                  <Text style={styles.expandPillText}>{expanded ? 'Collapse' : 'Expand'}</Text>
                </View>
              </View>
            </Pressable>

            {expanded ? (
              <View style={styles.groupChildren}>
                {group.entries.map((entry) => (
                  <OccurrenceCard
                    key={entry.occurrence.id}
                    occurrence={entry.occurrence}
                    task={entry.task}
                    onComplete={() => onComplete(entry.occurrence.id)}
                    onSkip={() => onSkip(entry.occurrence.id)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
  groupBlock: {
    marginBottom: 10,
  },
  groupCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#F0FAF9',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  groupMain: {
    flex: 1,
  },
  groupTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  groupMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  expandPill: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  expandPillText: {
    color: colors.brandDark,
    fontWeight: '700',
    fontSize: 12,
  },
  groupChildren: {
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
});
