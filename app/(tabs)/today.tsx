import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ScreenContainer } from '../../src/components/ScreenContainer';
import { colors } from '../../src/theme/colors';

export default function TodayScreen() {
  return (
    <ScreenContainer>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.subtitle}>Task list and quick actions are loading in the next commit slice.</Text>

      <Link href="/task-editor" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Open Task Editor</Text>
        </Pressable>
      </Link>
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
    marginBottom: 18,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
  },
});
