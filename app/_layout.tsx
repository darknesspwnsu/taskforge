import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '../src/providers/AppProviders';
import { colors } from '../src/theme/colors';

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    primary: colors.brand,
    text: colors.textPrimary,
    border: colors.border,
  },
};

export default function RootLayout() {
  return (
    <AppProviders>
      <ThemeProvider value={appTheme}>
        <StatusBar style="dark" />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="task-editor" options={{ title: 'Task Editor', presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </AppProviders>
  );
}
