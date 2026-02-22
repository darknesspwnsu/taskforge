import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../src/components/PrimaryButton';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { useTaskForge } from '../src/hooks/useTaskForge';
import { colors } from '../src/theme/colors';

const GOALS = [
  { id: 'focus', label: 'Beat procrastination' },
  { id: 'home', label: 'Keep chores organized' },
  { id: 'balance', label: 'Stay steady every day' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { setOnboardingComplete, updateNotificationSettings, upsertTask } = useTaskForge();

  const [goal, setGoal] = useState(GOALS[0].id);
  const [firstTaskTitle, setFirstTaskTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const finishOnboarding = async () => {
    setSubmitting(true);

    await updateNotificationSettings({
      dueAtEnabled: true,
      oneHourBeforeEnabled: true,
      dailySummaryEnabled: true,
      dailySummaryHour: 8,
    });

    const firstTitle = firstTaskTitle.trim();
    if (firstTitle) {
      await upsertTask({
        title: firstTitle,
        effort: 'normal',
        notes: `Onboarding goal: ${goal}`,
      });
    }

    await setOnboardingComplete(true);
    setSubmitting(false);
    router.replace('/(tabs)/today');
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Quick setup</Text>
      <Text style={styles.subtitle}>Two steps and TaskForge starts scoring your progress.</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Your primary goal</Text>
        <View style={styles.rowWrap}>
          {GOALS.map((item) => {
            const selected = item.id === goal;
            return (
              <Pressable
                key={item.id}
                onPress={() => setGoal(item.id)}
                style={[styles.goalChip, selected && styles.goalChipSelected]}>
                <Text style={[styles.goalChipText, selected && styles.goalChipTextSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Create your first task (optional)</Text>
        <TextInput
          value={firstTaskTitle}
          onChangeText={setFirstTaskTitle}
          placeholder="Ex: Deep clean kitchen"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
      </View>

      <PrimaryButton label="Start Using TaskForge" onPress={finishOnboarding} loading={submitting} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
    gap: 10,
  },
  label: {
    fontWeight: '700',
    color: colors.textPrimary,
    fontSize: 14,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  goalChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  goalChipSelected: {
    borderColor: colors.brand,
    backgroundColor: '#D9F5F2',
  },
  goalChipText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  goalChipTextSelected: {
    color: colors.brandDark,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
  },
});
