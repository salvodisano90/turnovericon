// components/Stepper.tsx

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface Props {
  value: number;
  onChange: (delta: number) => void;
}

export default function Stepper({ value, onChange }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { borderColor: colors.line }]}>
      <Pressable style={styles.btn} onPress={() => onChange(-1)} hitSlop={6}>
        <Text style={[styles.sign, { color: colors.blue }]}>−</Text>
      </Pressable>
      <View style={[styles.valWrap, { borderColor: colors.line }]}>
        <Text style={[styles.val, { color: colors.text }]}>{value}</Text>
      </View>
      <Pressable style={styles.btn} onPress={() => onChange(1)} hitSlop={6}>
        <Text style={[styles.sign, { color: colors.blue }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, overflow: 'hidden' },
  btn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  sign: { fontSize: 22, fontWeight: '700' },
  valWrap: { minWidth: 46, height: 42, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderRightWidth: 1 },
  val: { fontSize: 16, fontWeight: '800' },
});
