// components/AppShell.tsx — guscio comune: TopBar + contenuto. La bottom nav è globale (Tabs custom tabBar).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import TopBar from './TopBar';

export default function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <TopBar title={title} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}
const styles = StyleSheet.create({ root: { flex: 1 }, content: { flex: 1 } });
