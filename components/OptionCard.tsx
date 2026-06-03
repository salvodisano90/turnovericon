// components/OptionCard.tsx

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface Props {
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}

export default function OptionCard({ selected, disabled, onPress, children }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[
        styles.card,
        {
          borderColor: selected ? colors.blue : colors.line,
          backgroundColor: selected ? colors.blueSoft : colors.card,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
});
