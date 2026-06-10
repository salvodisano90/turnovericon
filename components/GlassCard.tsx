// components/GlassCard.tsx — superficie "vetro soft": traslucida, bordo sottile, ombra morbida.
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { DS } from '../utils/designSystem';

export default function GlassCard({ children, style, padded = true }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.base, padded && { padding: 16 }, DS.shadow.card, style]}>{children}</View>;
}
const styles = StyleSheet.create({
  base: { backgroundColor: DS.color.card, borderColor: DS.color.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 24 },
});
