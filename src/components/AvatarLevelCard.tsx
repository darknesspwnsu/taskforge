import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { avatarGradientByStage, colors } from '../theme/colors';

export function AvatarLevelCard({
  level,
  totalXp,
  currentStreak,
  stage,
  progressToNext,
}: {
  level: number;
  totalXp: number;
  currentStreak: number;
  stage: number;
  progressToNext: number;
}) {
  const gradient = avatarGradientByStage[stage] ?? avatarGradientByStage[1];

  return (
    <View style={styles.card}>
      <LinearGradient colors={gradient} style={styles.avatarOrb}>
        <Text style={styles.avatarText}>S{stage}</Text>
      </LinearGradient>

      <View style={styles.info}>
        <Text style={styles.level}>Level {level}</Text>
        <Text style={styles.meta}>{totalXp} XP · {currentStreak} day streak</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(Math.max(progressToNext * 100, 0), 100)}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 14,
  },
  avatarOrb: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  info: {
    flex: 1,
  },
  level: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 17,
  },
  meta: {
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#D8EAEE',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: colors.brand,
    borderRadius: 999,
  },
});
