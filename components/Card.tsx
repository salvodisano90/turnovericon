// components/Card.tsx

import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
}

export default function Card({ children, style, noPadding }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card },
        !noPadding && styles.padding,
        noPadding && styles.clip,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    marginBottom: 12,
  },
  padding: { padding: 16 },
  clip: { overflow: 'hidden' },
});
