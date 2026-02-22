import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../src/components/PrimaryButton';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { VoiceDictationButton } from '../src/components/VoiceDictationButton';
import { useTaskForge } from '../src/hooks/useTaskForge';
import { colors } from '../src/theme/colors';
import type { ComplexSubtaskInput } from '../src/lib/taskEngine';
import type { TaskEffort } from '../src/types/domain';

function parseSubtaskLines(lines: string): ComplexSubtaskInput[] {
  return lines
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [titlePart = '', effortPart = '', minutesPart = ''] = line.split('|').map((token) => token.trim());
      const normalizedEffort = effortPart.toLowerCase();
      const effort: TaskEffort =
        normalizedEffort === 'quick' || normalizedEffort === 'deep' ? normalizedEffort : 'normal';

      const parsedMinutes = Number(minutesPart);

      return {
        title: titlePart,
        effort,
        estimatedMinutes: Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? parsedMinutes : undefined,
      };
    })
    .filter((item) => item.title.length > 0);
}

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

export default function ComplexTaskScreen() {
  const router = useRouter();
  const { createComplexTask } = useTaskForge();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('240');
  const [subtaskLines, setSubtaskLines] = useState('Pack kitchen | normal | 60\nBook movers | quick | 30');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const saveComplexTask = async () => {
    const subtasks = parseSubtaskLines(subtaskLines);
    if (!title.trim() || subtasks.length === 0) {
      setMessage('Add a parent title and at least one subtask line.');
      return;
    }

    setSaving(true);
    const parsedEstimatedMinutes = Number(estimatedMinutes);

    await createComplexTask({
      title,
      notes,
      dueAt: dueAt.trim() || undefined,
      estimatedMinutes:
        Number.isFinite(parsedEstimatedMinutes) && parsedEstimatedMinutes > 0
          ? parsedEstimatedMinutes
          : undefined,
      subtasks,
    });

    setSaving(false);
    router.back();
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Complex Task Builder</Text>
      <Text style={styles.subtitle}>
        Break a large objective into smaller subtasks so it can be scheduled and completed in chunks.
      </Text>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Parent task title</Text>
          <VoiceDictationButton
            onTranscript={(spoken) => setTitle((previous) => appendText(previous, spoken))}
            onError={setMessage}
          />
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          placeholder="Move apartments"
        />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Notes (optional)</Text>
          <VoiceDictationButton
            onTranscript={(spoken) => setNotes((previous) => appendText(previous, spoken))}
            onError={setMessage}
          />
        </View>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, styles.textarea]}
          multiline
          placeholder="Context and constraints"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Target due date/time (optional ISO)</Text>
        <TextInput
          value={dueAt}
          onChangeText={setDueAt}
          style={styles.input}
          placeholder="2026-03-05T19:00:00Z"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Total estimated minutes (optional)</Text>
        <TextInput
          value={estimatedMinutes}
          onChangeText={setEstimatedMinutes}
          keyboardType="number-pad"
          style={styles.input}
          placeholder="240"
        />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Subtasks (one per line)</Text>
          <VoiceDictationButton
            onTranscript={(spoken) =>
              setSubtaskLines((previous) => (previous.trim().length > 0 ? `${previous}\n${spoken}` : spoken))
            }
            onError={setMessage}
          />
        </View>
        <Text style={styles.helper}>Format: `title | effort(optional) | minutes(optional)`</Text>
        <TextInput
          value={subtaskLines}
          onChangeText={setSubtaskLines}
          style={[styles.input, styles.subtaskArea]}
          multiline
          placeholder="Pack bedroom | normal | 60"
        />
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      <PrimaryButton label="Create Complex Task" onPress={saveComplexTask} loading={saving} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 14,
    fontSize: 14,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 5,
    fontSize: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  textarea: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  subtaskArea: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  message: {
    color: colors.brandDark,
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
});
