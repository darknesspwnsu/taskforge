import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { useAuth } from '../../src/hooks/useAuth';
import { colors } from '../../src/theme/colors';

export default function SignInScreen() {
  const router = useRouter();
  const { signInWithMagicLink, isDemoMode } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const helperText = useMemo(
    () =>
      isDemoMode
        ? 'Supabase env vars not found. You are in local demo mode for rapid MVP testing.'
        : 'We send a magic link so your account is accessible on web and mobile.',
    [isDemoMode],
  );

  const onSubmit = async () => {
    setSubmitting(true);
    const result = await signInWithMagicLink(email);
    setMessage(result.message);
    setSubmitting(false);

    if (result.ok && isDemoMode) {
      router.replace('/onboarding');
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.headlineBlock}>
        <Text style={styles.kicker}>TaskForge</Text>
        <Text style={styles.title}>Turn chores into progression</Text>
        <Text style={styles.subtitle}>
          Build momentum with XP, levels, and streaks while staying on top of your real-world tasks.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <Text style={styles.helper}>{helperText}</Text>

        <PrimaryButton
          label={isDemoMode ? 'Continue In Demo Mode' : 'Send Magic Link'}
          onPress={onSubmit}
          disabled={!email.trim()}
          loading={submitting}
        />

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headlineBlock: {
    gap: 8,
    marginBottom: 32,
  },
  kicker: {
    color: colors.brand,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 12,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  form: {
    gap: 10,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
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
  helper: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  message: {
    color: colors.brandDark,
    fontWeight: '600',
    fontSize: 13,
    marginTop: 8,
  },
});
