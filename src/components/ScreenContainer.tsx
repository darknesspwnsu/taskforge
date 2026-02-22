import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

export function ScreenContainer({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const content = (
    <View style={styles.inner}>
      <View style={styles.frost}>{children}</View>
    </View>
  );

  return (
    <LinearGradient colors={[colors.bgAccent, colors.bg]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 120,
  },
  inner: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  frost: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 2,
  },
});
