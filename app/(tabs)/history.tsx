import { StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../src/components/ScreenContainer';
import { useTaskForge } from '../../src/hooks/useTaskForge';
import { colors } from '../../src/theme/colors';

export default function HistoryScreen() {
  const { snapshot } = useTaskForge();

  return (
    <ScreenContainer>
      <Text style={styles.title}>History</Text>
      <Text style={styles.subtitle}>Recent completions, skips, and XP payouts.</Text>

      {!snapshot || snapshot.xpLedger.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No XP events yet. Complete a task to start your log.</Text>
        </View>
      ) : (
        snapshot.xpLedger.slice(0, 40).map((event) => (
          <View style={styles.eventCard} key={event.id}>
            <View style={styles.row}>
              <Text style={styles.eventTitle}>{event.eventType === 'task_completed' ? 'Task Completed' : 'Task Skipped'}</Text>
              <Text style={[styles.xpValue, event.awardedXp === 0 && styles.zeroXp]}>
                {event.awardedXp > 0 ? `+${event.awardedXp} XP` : '0 XP'}
              </Text>
            </View>
            <Text style={styles.eventMeta}>{new Date(event.createdAt).toLocaleString()}</Text>
            {event.note ? <Text style={styles.eventNote}>{event.note}</Text> : null}
          </View>
        ))
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
    fontSize: 14,
    marginBottom: 12,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 12,
  },
  emptyText: {
    color: colors.textSecondary,
  },
  eventCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eventTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  xpValue: {
    color: colors.success,
    fontWeight: '800',
  },
  zeroXp: {
    color: colors.warning,
  },
  eventMeta: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
  },
  eventNote: {
    marginTop: 6,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});
