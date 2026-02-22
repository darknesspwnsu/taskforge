import React, { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { useTaskForge } from '../../src/hooks/useTaskForge';
import { colors } from '../../src/theme/colors';

function splitWindow(window: { start: string; end: string } | undefined, fallbackStart: string, fallbackEnd: string) {
  return {
    start: window?.start ?? fallbackStart,
    end: window?.end ?? fallbackEnd,
  };
}

function PlannerInputRow({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function PlannerScreen() {
  const {
    snapshot,
    plannerSuggestions,
    updatePlannerSettings,
    generatePlannerSuggestions,
    importPlannerCalendarFromIcs,
  } = useTaskForge();

  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);

  const plannerDefaults = snapshot?.settings.planner;

  const workWindow = splitWindow(plannerDefaults?.workWeekdays[0], '09:00', '17:00');
  const sleepWindow = splitWindow(plannerDefaults?.sleepDaily[0], '23:00', '07:00');
  const freeWeekdayWindow = splitWindow(plannerDefaults?.freeWeekdays[0], '18:00', '21:30');
  const freeWeekendWindow = splitWindow(plannerDefaults?.freeWeekends[0], '10:00', '17:00');

  const [workStart, setWorkStart] = useState(workWindow.start);
  const [workEnd, setWorkEnd] = useState(workWindow.end);
  const [sleepStart, setSleepStart] = useState(sleepWindow.start);
  const [sleepEnd, setSleepEnd] = useState(sleepWindow.end);
  const [freeWeekdayStart, setFreeWeekdayStart] = useState(freeWeekdayWindow.start);
  const [freeWeekdayEnd, setFreeWeekdayEnd] = useState(freeWeekdayWindow.end);
  const [freeWeekendStart, setFreeWeekendStart] = useState(freeWeekendWindow.start);
  const [freeWeekendEnd, setFreeWeekendEnd] = useState(freeWeekendWindow.end);
  const [maxSessionMinutes, setMaxSessionMinutes] = useState(
    String(snapshot?.settings.planner.maxSessionMinutes ?? 90),
  );
  const [aiEnabled, setAiEnabled] = useState(snapshot?.settings.planner.autoUseAi ?? false);
  const [aiApiKey, setAiApiKey] = useState(snapshot?.settings.planner.openAiApiKey ?? '');
  const [icsUrl, setIcsUrl] = useState('');

  const eventsCount = snapshot?.plannerCalendarEvents.length ?? 0;

  const suggestions = useMemo(
    () =>
      [...plannerSuggestions].sort(
        (left, right) => new Date(left.start).getTime() - new Date(right.start).getTime(),
      ),
    [plannerSuggestions],
  );

  if (!snapshot) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Planner</Text>
      </ScreenContainer>
    );
  }

  const saveSchedule = async () => {
    setSaving(true);
    await updatePlannerSettings({
      workWeekdays: [{ start: workStart, end: workEnd }],
      sleepDaily: [{ start: sleepStart, end: sleepEnd }],
      freeWeekdays: [{ start: freeWeekdayStart, end: freeWeekdayEnd }],
      freeWeekends: [{ start: freeWeekendStart, end: freeWeekendEnd }],
      maxSessionMinutes: Math.max(30, Math.min(Number(maxSessionMinutes) || 90, 90)),
      autoUseAi: aiEnabled,
      openAiApiKey: aiApiKey.trim(),
    });
    setSaving(false);
    setMessage('Planner preferences saved.');
  };

  const runPlanner = async () => {
    setGenerating(true);
    await generatePlannerSuggestions({
      useAi: aiEnabled,
      apiKey: aiApiKey.trim() || undefined,
    });
    setGenerating(false);
    setMessage(aiEnabled ? 'Generated AI-assisted suggestions.' : 'Generated heuristic suggestions.');
  };

  const importCalendar = async () => {
    setImporting(true);
    const result = await importPlannerCalendarFromIcs(icsUrl);
    setImporting(false);
    setMessage(result.message);
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Planner</Text>
      <Text style={styles.subtitle}>Set schedule boundaries and generate chore timeslots.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Schedule Inputs</Text>
        <PlannerInputRow label="Work start (weekdays)" value={workStart} onChangeText={setWorkStart} placeholder="09:00" />
        <PlannerInputRow label="Work end (weekdays)" value={workEnd} onChangeText={setWorkEnd} placeholder="17:00" />
        <PlannerInputRow label="Sleep start (daily)" value={sleepStart} onChangeText={setSleepStart} placeholder="23:00" />
        <PlannerInputRow label="Sleep end (daily)" value={sleepEnd} onChangeText={setSleepEnd} placeholder="07:00" />
        <PlannerInputRow
          label="Free time start (weekdays)"
          value={freeWeekdayStart}
          onChangeText={setFreeWeekdayStart}
          placeholder="18:00"
        />
        <PlannerInputRow
          label="Free time end (weekdays)"
          value={freeWeekdayEnd}
          onChangeText={setFreeWeekdayEnd}
          placeholder="21:30"
        />
        <PlannerInputRow
          label="Free time start (weekends)"
          value={freeWeekendStart}
          onChangeText={setFreeWeekendStart}
          placeholder="10:00"
        />
        <PlannerInputRow
          label="Free time end (weekends)"
          value={freeWeekendEnd}
          onChangeText={setFreeWeekendEnd}
          placeholder="17:00"
        />
        <PlannerInputRow
          label="Max session minutes (<=90)"
          value={maxSessionMinutes}
          onChangeText={setMaxSessionMinutes}
          placeholder="90"
        />
        <PrimaryButton label="Save Planner Preferences" onPress={saveSchedule} loading={saving} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Suggestion Engine</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Use AI suggestions</Text>
          <Switch
            value={aiEnabled}
            onValueChange={setAiEnabled}
            trackColor={{ true: colors.brand, false: '#CBD8DE' }}
          />
        </View>

        <PlannerInputRow
          label="OpenAI API key (stored locally, optional)"
          value={aiApiKey}
          onChangeText={setAiApiKey}
          placeholder="sk-..."
          secureTextEntry
        />

        <PrimaryButton label="Generate Suggestions" onPress={runPlanner} loading={generating} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Calendar Import (ICS)</Text>
        <Text style={styles.noteText}>
          Import a Google Calendar private ICS link to block existing events.
        </Text>
        <PlannerInputRow label="ICS URL" value={icsUrl} onChangeText={setIcsUrl} placeholder="https://.../basic.ics" />
        <PrimaryButton label="Import Calendar" onPress={importCalendar} loading={importing} />
        <Text style={styles.noteText}>Imported events: {eventsCount}</Text>
      </View>

      <Text style={styles.sectionTitle}>Suggested Time Slots</Text>
      {suggestions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No suggestions yet. Generate a plan from your pending tasks.</Text>
        </View>
      ) : (
        suggestions.map((item) => (
          <View key={item.id} style={styles.suggestionCard}>
            <Text style={styles.suggestionTitle}>{item.title}</Text>
            <Text style={styles.suggestionMeta}>
              {new Date(item.start).toLocaleString()} - {new Date(item.end).toLocaleTimeString()}
            </Text>
            <Text style={styles.suggestionMeta}>
              {item.minutes} min · {item.source.toUpperCase()}
            </Text>
            {item.note ? <Text style={styles.noteText}>{item.note}</Text> : null}
          </View>
        ))
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}
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
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 12,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 17,
    marginBottom: 8,
  },
  field: {
    marginBottom: 8,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toggleLabel: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 8,
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
  suggestionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 8,
  },
  suggestionTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  suggestionMeta: {
    color: colors.textSecondary,
    marginTop: 3,
    fontSize: 12,
  },
  noteText: {
    color: colors.textSecondary,
    marginTop: 4,
    fontSize: 12,
  },
  message: {
    marginTop: 12,
    color: colors.brandDark,
    fontWeight: '600',
  },
});
