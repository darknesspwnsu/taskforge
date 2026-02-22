import type { PostgrestError } from '@supabase/supabase-js';

import type { OfflineAction, TaskOccurrence } from '../types/domain';
import type { TaskForgeSnapshot } from '../types/state';
import { createClientActionId, createUuid } from './id';
import { supabase } from './supabase';

type SyncResult = {
  ok: boolean;
  error?: string;
};

export function enqueueOfflineAction(
  snapshot: TaskForgeSnapshot,
  action: Omit<OfflineAction, 'id' | 'createdAt' | 'attempts'>,
): TaskForgeSnapshot {
  return {
    ...snapshot,
    offlineQueue: [
      ...snapshot.offlineQueue,
      {
        ...action,
        id: createUuid(),
        createdAt: new Date().toISOString(),
        attempts: 0,
      },
    ],
  };
}

function toErrorMessage(error: PostgrestError | Error | unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Error).message);
  }

  return 'Unknown sync failure';
}

function payloadDueAt(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

async function syncAction(action: OfflineAction): Promise<SyncResult> {
  if (!supabase) {
    return { ok: false, error: 'Supabase not configured' };
  }

  try {
    switch (action.type) {
      case 'create_task':
      case 'edit_task': {
        const payload = action.payload as Record<string, unknown>;

        const { error } = await supabase.from('tasks').upsert({
          id: payload.id,
          user_id: payload.userId,
          title: payload.title,
          notes: payload.notes,
          effort: payload.effort,
          due_at: payloadDueAt(payload.dueAt),
          manual_xp: payload.manualXp,
          recurrence_rule: payload.recurrenceRule ?? null,
          active: payload.active,
          updated_at: new Date().toISOString(),
        });

        if (error) {
          return { ok: false, error: toErrorMessage(error) };
        }

        return { ok: true };
      }
      case 'complete_occurrence': {
        const payload = action.payload as Record<string, string>;
        const { error } = await supabase.rpc('complete_occurrence', {
          occurrence_id: payload.occurrenceId,
          completed_at: payload.completedAt,
          client_action_id: payload.clientActionId,
        });

        if (error) {
          return { ok: false, error: toErrorMessage(error) };
        }

        return { ok: true };
      }
      case 'skip_occurrence': {
        const payload = action.payload as Record<string, string | undefined>;
        const { error } = await supabase.rpc('skip_occurrence', {
          occurrence_id: payload.occurrenceId,
          skipped_at: payload.skippedAt,
          reason: payload.reason ?? null,
          client_action_id: payload.clientActionId,
        });

        if (error) {
          return { ok: false, error: toErrorMessage(error) };
        }

        return { ok: true };
      }
      default:
        return { ok: true };
    }
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    };
  }
}

export async function flushOfflineQueue(snapshot: TaskForgeSnapshot): Promise<TaskForgeSnapshot> {
  if (!supabase || snapshot.offlineQueue.length === 0) {
    return snapshot;
  }

  let queue = [...snapshot.offlineQueue];

  for (const action of snapshot.offlineQueue) {
    const result = await syncAction(action);

    if (result.ok) {
      queue = queue.filter((item) => item.id !== action.id);
      continue;
    }

    queue = queue.map((item) =>
      item.id === action.id
        ? {
            ...item,
            attempts: item.attempts + 1,
            lastError: result.error,
          }
        : item,
    );
  }

  return {
    ...snapshot,
    offlineQueue: queue,
    lastSyncedAt: new Date().toISOString(),
  };
}

export function createCompleteActionPayload(occurrence: TaskOccurrence): Record<string, unknown> {
  const completedAt = new Date().toISOString();
  return {
    occurrenceId: occurrence.id,
    completedAt,
    clientActionId: createClientActionId('complete'),
  };
}

export function createSkipActionPayload(occurrence: TaskOccurrence, reason?: string): Record<string, unknown> {
  const skippedAt = new Date().toISOString();
  return {
    occurrenceId: occurrence.id,
    skippedAt,
    reason,
    clientActionId: createClientActionId('skip'),
  };
}
