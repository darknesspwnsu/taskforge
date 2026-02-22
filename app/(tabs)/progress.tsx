import { StyleSheet, Text, View } from 'react-native';

import { AvatarLevelCard } from '../../src/components/AvatarLevelCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { useTaskForge } from '../../src/hooks/useTaskForge';
import { xpThresholdForLevel } from '../../src/lib/xp';
import { colors } from '../../src/theme/colors';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function ProgressScreen() {
  const { snapshot } = useTaskForge();

  if (!snapshot) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Progress</Text>
      </ScreenContainer>
    );
  }

  const nextThreshold = xpThresholdForLevel(snapshot.progress.level + 1);
  const currentThreshold = xpThresholdForLevel(snapshot.progress.level);
  const xpIntoLevel = snapshot.progress.totalXp - currentThreshold;
  const xpNeeded = Math.max(nextThreshold - currentThreshold, 1);
  const progressToNext = xpIntoLevel / xpNeeded;

  return (
    <ScreenContainer>
      <Text style={styles.title}>Progress</Text>
      <Text style={styles.subtitle}>Your momentum stats and avatar evolution state.</Text>

      <AvatarLevelCard
        level={snapshot.progress.level}
        totalXp={snapshot.progress.totalXp}
        currentStreak={snapshot.progress.currentStreakDays}
        stage={snapshot.avatar.stage}
        progressToNext={progressToNext}
      />

      <View style={styles.metricGrid}>
        <Metric label="XP To Next" value={String(Math.max(nextThreshold - snapshot.progress.totalXp, 0))} />
        <Metric label="Current Streak" value={`${snapshot.progress.currentStreakDays}d`} />
        <Metric label="Longest Streak" value={`${snapshot.progress.longestStreakDays}d`} />
        <Metric label="Avatar Stage" value={`S${snapshot.avatar.stage}`} />
      </View>
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
    marginBottom: 14,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  metricValue: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 22,
  },
  metricLabel: {
    color: colors.textSecondary,
    marginTop: 4,
    fontSize: 12,
  },
});
