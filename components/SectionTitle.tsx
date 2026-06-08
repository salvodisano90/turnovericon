// components/SectionTitle.tsx

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export default function SectionTitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.t, { color: colors.text2 }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  t: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 8,
    marginBottom: 8,
    marginHorizontal: 4,
  },
});
