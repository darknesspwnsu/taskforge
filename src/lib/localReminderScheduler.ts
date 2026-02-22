import AsyncStorage from '@react-native-async-storage/async-storage';
import { addHours, isAfter, parseISO } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { TaskForgeSnapshot } from '../types/state';

const SCHEDULED_KEY_PREFIX = 'taskforge:v1:scheduled-notifications';

function keyForUser(userId: string): string {
  return `${SCHEDULED_KEY_PREFIX}:${userId}`;
}

type ScheduledMap = Record<string, string>;

async function getScheduledMap(userId: string): Promise<ScheduledMap> {
  const value = await AsyncStorage.getItem(keyForUser(userId));

  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as ScheduledMap;
  } catch {
    return {};
  }
}

async function saveScheduledMap(userId: string, map: ScheduledMap): Promise<void> {
  await AsyncStorage.setItem(keyForUser(userId), JSON.stringify(map));
}

function dedupeKey(occurrenceId: string, type: 'due' | 'one-hour-before'): string {
  return `${occurrenceId}:${type}`;
}

async function scheduleSingle(
  map: ScheduledMap,
  occurrenceId: string,
  triggerAt: Date,
  content: { title: string; body: string },
  type: 'due' | 'one-hour-before',
): Promise<void> {
  const key = dedupeKey(occurrenceId, type);

  if (map[key]) {
    return;
  }

  if (!isAfter(triggerAt, new Date())) {
    return;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerAt,
    },
  });

  map[key] = id;
}

export async function syncLocalReminderSchedules(
  userId: string,
  snapshot: TaskForgeSnapshot,
): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const map = await getScheduledMap(userId);
  const nextKeys = new Set<string>();

  const pending = snapshot.occurrences.filter((item) => item.status === 'pending' && item.dueAt);

  for (const occurrence of pending) {
    const task = snapshot.tasks.find((item) => item.id === occurrence.taskId);
    if (!task || !occurrence.dueAt) {
      continue;
    }

    const dueAt = parseISO(occurrence.dueAt);

    if (snapshot.settings.notifications.dueAtEnabled) {
      await scheduleSingle(
        map,
        occurrence.id,
        dueAt,
        {
          title: `Task due: ${task.title}`,
          body: 'Open TaskForge to complete this task.',
        },
        'due',
      );
      nextKeys.add(dedupeKey(occurrence.id, 'due'));
    }

    if (snapshot.settings.notifications.oneHourBeforeEnabled) {
      await scheduleSingle(
        map,
        occurrence.id,
        addHours(dueAt, -1),
        {
          title: `Upcoming task: ${task.title}`,
          body: 'This task is due in one hour.',
        },
        'one-hour-before',
      );
      nextKeys.add(dedupeKey(occurrence.id, 'one-hour-before'));
    }
  }

  const staleKeys = Object.keys(map).filter((existingKey) => !nextKeys.has(existingKey));

  for (const staleKey of staleKeys) {
    const id = map[staleKey];
    await Notifications.cancelScheduledNotificationAsync(id);
    delete map[staleKey];
  }

  await saveScheduledMap(userId, map);
}
