// components/CoverageBar.tsx

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface Props {
  label: string;
  pct: number;
  labelColor?: string;
}

export default function CoverageBar({ label, pct, labelColor }: Props) {
  const { colors } = useTheme();
  const fill = pct >= 90 ? colors.green : pct >= 70 ? colors.yellow : colors.red;
  return (
    <View style={styles.row}>
      <Text style={[styles.code, { color: labelColor || colors.text2 }]}>{label}</Text>
      <View style={[styles.bar, { backgroundColor: colors.line }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fill }]} />
      </View>
      <Text style={[styles.pct, { color: fill }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 },
  code: { fontSize: 11, fontWeight: '700', width: 48 },
  bar: { flex: 1, height: 8, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  pct: { fontSize: 12, fontWeight: '700', width: 40, textAlign: 'right' },
});
