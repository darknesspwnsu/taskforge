import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { useAuth } from '../../src/hooks/useAuth';
import { useTaskForge } from '../../src/hooks/useTaskForge';
import { registerWebPushSubscription, requestLocalNotificationPermission } from '../../src/lib/notifications';
import { colors } from '../../src/theme/colors';

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.brand, false: '#CBD8DE' }} />
    </View>
  );
}

export default function SettingsScreen() {
  const { user, signOut, isDemoMode } = useAuth();
  const { snapshot, updateNotificationSettings, flushQueue } = useTaskForge();

  const [message, setMessage] = useState('');
  const [syncing, setSyncing] = useState(false);

  if (!snapshot) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Settings</Text>
      </ScreenContainer>
    );
  }

  const updateToggle = async (field: 'dueAtEnabled' | 'oneHourBeforeEnabled' | 'dailySummaryEnabled', value: boolean) => {
    await updateNotificationSettings({
      [field]: value,
    });
  };

  const syncNow = async () => {
    setSyncing(true);
    await flushQueue();
    setSyncing(false);
    setMessage('Queue sync attempted.');
  };

  const enableInAppNotifications = async () => {
    const result = await requestLocalNotificationPermission();
    setMessage(result.message);
  };

  const enableWebPush = async () => {
    if (!user) {
      return;
    }

    const result = await registerWebPushSubscription(user.id);
    setMessage(result.message);
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Tune reminders, sync behavior, and account access.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>
        <Text style={styles.cardText}>Email: {user?.email ?? 'Unknown'}</Text>
        <Text style={styles.cardText}>Timezone: {snapshot.settings.timezone}</Text>
        <Text style={styles.cardText}>Mode: {isDemoMode ? 'Demo (local only)' : 'Supabase connected'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <ToggleRow
          label="At due time"
          value={snapshot.settings.notifications.dueAtEnabled}
          onValueChange={(next) => void updateToggle('dueAtEnabled', next)}
        />
        <ToggleRow
          label="One hour before"
          value={snapshot.settings.notifications.oneHourBeforeEnabled}
          onValueChange={(next) => void updateToggle('oneHourBeforeEnabled', next)}
        />
        <ToggleRow
          label="Daily summary"
          value={snapshot.settings.notifications.dailySummaryEnabled}
          onValueChange={(next) => void updateToggle('dailySummaryEnabled', next)}
        />

        <View style={styles.actionStack}>
          <PrimaryButton label="Enable In-App Notifications" onPress={() => void enableInAppNotifications()} />
          <PrimaryButton label="Enable Web Push" onPress={() => void enableWebPush()} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Offline queue</Text>
        <Text style={styles.cardText}>Pending actions: {snapshot.offlineQueue.length}</Text>
        <Text style={styles.cardText}>Last sync: {snapshot.lastSyncedAt ? new Date(snapshot.lastSyncedAt).toLocaleString() : 'Never'}</Text>
        <View style={styles.actionStack}>
          <PrimaryButton label="Sync Now" onPress={() => void syncNow()} loading={syncing} />
        </View>
      </View>

      <Pressable style={styles.signOutButton} onPress={() => void signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

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
    fontSize: 14,
    marginBottom: 12,
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
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  cardText: {
    color: colors.textSecondary,
    marginBottom: 4,
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleLabel: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  actionStack: {
    marginTop: 10,
    gap: 8,
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutText: {
    color: colors.danger,
    fontWeight: '800',
  },
  message: {
    marginTop: 12,
    color: colors.brandDark,
    fontWeight: '600',
  },
});
