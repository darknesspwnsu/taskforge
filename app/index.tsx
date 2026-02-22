import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../src/hooks/useAuth';
import { useTaskForge } from '../src/hooks/useTaskForge';
import { colors } from '../src/theme/colors';

export default function IndexRoute() {
  const { user, loading: authLoading } = useAuth();
  const { snapshot, loading: snapshotLoading } = useTaskForge();

  if (authLoading || (user && snapshotLoading)) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!snapshot?.settings.onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/today" />;
}
