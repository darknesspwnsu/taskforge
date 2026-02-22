import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GroupedOccurrenceList } from '../../src/components/GroupedOccurrenceList';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { useTaskForge } from '../../src/hooks/useTaskForge';
import { colors } from '../../src/theme/colors';

export default function UpcomingScreen() {
  const { snapshot, upcomingOccurrences, completeOccurrence, skipOccurrence } = useTaskForge();

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

      <GroupedOccurrenceList
        snapshot={snapshot}
        occurrences={upcomingOccurrences}
        emptyText="No upcoming deadlines yet."
        onComplete={(occurrenceId) => void completeOccurrence(occurrenceId)}
        onSkip={(occurrenceId) => void skipOccurrence(occurrenceId)}
      />
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
});
