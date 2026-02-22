import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TaskForgeSnapshot } from '../types/state';
import { createDefaultSnapshot } from '../types/state';

const SNAPSHOT_KEY_PREFIX = 'taskforge:v1:snapshot';

function snapshotKey(userId: string): string {
  return `${SNAPSHOT_KEY_PREFIX}:${userId}`;
}

export async function loadSnapshot(userId: string, timezone: string): Promise<TaskForgeSnapshot> {
  const serialized = await AsyncStorage.getItem(snapshotKey(userId));

  if (!serialized) {
    return createDefaultSnapshot(userId, timezone);
  }

  try {
    return JSON.parse(serialized) as TaskForgeSnapshot;
  } catch (error) {
    console.warn('Unable to parse local snapshot, restoring defaults', error);
    return createDefaultSnapshot(userId, timezone);
  }
}

export async function saveSnapshot(userId: string, snapshot: TaskForgeSnapshot): Promise<void> {
  await AsyncStorage.setItem(snapshotKey(userId), JSON.stringify(snapshot));
}
