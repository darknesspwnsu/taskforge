import { StyleSheet, Text } from 'react-native';

import { ScreenContainer } from '../../src/components/ScreenContainer';
import { colors } from '../../src/theme/colors';

export default function SettingsScreen() {
  return (
    <ScreenContainer>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Notification controls, queue sync, and account actions will appear here.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
