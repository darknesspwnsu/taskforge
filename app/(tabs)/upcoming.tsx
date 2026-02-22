import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { OccurrenceCard } from '../../src/components/OccurrenceCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { useTaskForge } from '../../src/hooks/useTaskForge';
import { colors } from '../../src/theme/colors';

export default function UpcomingScreen() {
  const { snapshot, upcomingOccurrences, completeOccurrence, skipOccurrence } = useTaskForge();

  const taskById = new Map((snapshot?.tasks ?? []).map((task) => [task.id, task]));

  return (
    <ScreenContainer>
      <View style={styles.rowHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Upcoming</Text>
          <Text style={styles.subtitle}>Recurring and future occurrences over the next horizon.</Text>
        </View>
        <Link href="/task-editor" style={styles.linkButton}>
          Add
        </Link>
      </View>

      {upcomingOccurrences.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No upcoming deadlines yet.</Text>
        </View>
      ) : (
        upcomingOccurrences.map((occurrence) => {
          const task = taskById.get(occurrence.taskId);
          if (!task) {
            return null;
          }

          return (
            <OccurrenceCard
              key={occurrence.id}
              occurrence={occurrence}
              task={task}
              onComplete={() => void completeOccurrence(occurrence.id)}
              onSkip={() => void skipOccurrence(occurrence.id)}
            />
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowHeader: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  linkButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.brand,
    color: colors.brandDark,
    fontWeight: '700',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 8,
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
});
