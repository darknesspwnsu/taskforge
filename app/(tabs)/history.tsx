import { StyleSheet, Text } from 'react-native';

import { ScreenContainer } from '../../src/components/ScreenContainer';
import { colors } from '../../src/theme/colors';

export default function HistoryScreen() {
  return (
    <ScreenContainer>
      <Text style={styles.title}>History</Text>
      <Text style={styles.subtitle}>XP ledger events and completion logs are coming next.</Text>
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
