// components/StepsDots.tsx

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export default function StepsDots({ total, current }: { total: number; current: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const active = n <= current;
        return <View key={n} style={[styles.dot, { backgroundColor: active ? colors.blue : colors.line }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, paddingHorizontal: 16, marginBottom: 10 },
  dot: { flex: 1, height: 4, borderRadius: 3 },
});
