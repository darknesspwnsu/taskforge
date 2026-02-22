import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { env } from './env';
import { supabase } from './supabase';

function base64ToUint8Array(base64: string): Uint8Array {
  const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const raw = atob(`${normalized}${padding}`);

  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function isGrantedPermission(permission: unknown): boolean {
  if (!permission || typeof permission !== 'object') {
    return false;
  }

  const candidate = permission as { granted?: boolean; status?: string };
  return Boolean(candidate.granted || candidate.status === 'granted');
}

export async function requestLocalNotificationPermission(): Promise<{ ok: boolean; message: string }> {
  const existing = await Notifications.getPermissionsAsync();

  if (isGrantedPermission(existing)) {
    return {
      ok: true,
      message: 'Notifications already enabled.',
    };
  }

  const requested = await Notifications.requestPermissionsAsync();

  if (!isGrantedPermission(requested)) {
    return {
      ok: false,
      message: 'Notification permission denied.',
    };
  }

  return {
    ok: true,
    message: 'Notification permission granted.',
  };
}

export async function registerWebPushSubscription(
  userId: string,
): Promise<{ ok: boolean; message: string }> {
  if (Platform.OS !== 'web') {
    return {
      ok: false,
      message: 'Web push registration is only available in browser builds.',
    };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      ok: false,
      message: 'Push notifications are not supported by this browser.',
    };
  }

  if (!env.webPushPublicKey) {
    return {
      ok: false,
      message: 'Set EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY to enable browser push.',
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      message: 'Browser push permission denied.',
    };
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(env.webPushPublicKey) as unknown as BufferSource,
    });

    const keys = subscription.toJSON().keys;

    if (supabase) {
      const { error } = await supabase.from('web_push_subscriptions').upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: keys?.p256dh,
        auth: keys?.auth,
        user_agent: navigator.userAgent,
      });

      if (error) {
        return {
          ok: false,
          message: error.message,
        };
      }
    }

    return {
      ok: true,
      message: 'Web push subscription registered.',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to register web push.',
    };
  }
}
