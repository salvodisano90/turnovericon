// components/SelectChip.tsx

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface Props {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export default function SelectChip({ label, selected, disabled, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? colors.blue : colors.line,
          backgroundColor: selected ? colors.blue : colors.card,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.txt, { color: selected ? '#fff' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5 },
  txt: { fontSize: 13, fontWeight: '600' },
});
