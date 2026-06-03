// components/Chip.tsx

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface Props {
  label: string;
  active?: boolean;
  onPress: () => void;
}

export default function Chip({ label, active, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? colors.blue : colors.card, borderColor: active ? colors.blue : colors.line },
      ]}
    >
      <Text style={[styles.txt, { color: active ? '#fff' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  txt: { fontSize: 13, fontWeight: '600' },
});
