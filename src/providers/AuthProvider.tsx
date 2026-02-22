import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { AuthUser } from '../types/state';
import { createUuid } from '../lib/id';
import { hasSupabaseConfig } from '../lib/env';
import { supabase } from '../lib/supabase';

type AuthContextValue = {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  isDemoMode: boolean;
  signInWithMagicLink: (email: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
};

const DEMO_USER_KEY = 'taskforge:v1:demo-user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function userFromSession(session: Session | null): AuthUser | null {
  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasSupabaseConfig && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setUser(userFromSession(data.session));
        setLoading(false);
      });

      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setUser(userFromSession(nextSession));
      });

      return () => {
        data.subscription.unsubscribe();
      };
    }

    AsyncStorage.getItem(DEMO_USER_KEY)
      .then((serialized) => {
        if (!serialized) {
          return;
        }

        try {
          setUser(JSON.parse(serialized) as AuthUser);
        } catch (error) {
          console.warn('Unable to parse demo user', error);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return undefined;
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const normalized = email.trim().toLowerCase();

    if (!normalized) {
      return { ok: false, message: 'Enter a valid email address.' };
    }

    if (hasSupabaseConfig && supabase) {
      const redirectTo = Linking.createURL('/');
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        return {
          ok: false,
          message: error.message,
        };
      }

      return {
        ok: true,
        message: 'Magic link sent. Check your inbox.',
      };
    }

    const nextUser: AuthUser = {
      id: createUuid(),
      email: normalized,
    };

    setUser(nextUser);
    await AsyncStorage.setItem(DEMO_USER_KEY, JSON.stringify(nextUser));

    return {
      ok: true,
      message: 'Demo mode signed in locally.',
    };
  }, []);

  const signOut = useCallback(async () => {
    if (hasSupabaseConfig && supabase) {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      return;
    }

    setUser(null);
    await AsyncStorage.removeItem(DEMO_USER_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      isDemoMode: !hasSupabaseConfig,
      signInWithMagicLink,
      signOut,
    }),
    [loading, session, signInWithMagicLink, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
