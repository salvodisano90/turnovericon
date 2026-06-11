// components/GlassCard.tsx — GLASS MATERIAL SYSTEM (FASE 2), 5 layer:
// 1 blur · 2 tinta traslucida · 3 bordo luminoso · 4 highlight superiore · 5 contenuto.
// Valori da token GLASS (blur 60, radius 32, border 0.12, highlight 0.18). Ombra minima.
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { DEPTH, GLASS } from '../utils/designSystem';

let BlurView: any = null;
try { BlurView = require('expo-blur').BlurView; } catch { BlurView = null; }

export default function GlassCard({ children, style, padded = true }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return (
    <View style={[styles.base, DEPTH.soft, style]}>
      {BlurView ? <BlurView intensity={GLASS.blur} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
      <View pointerEvents="none" style={styles.tint} />
      <View pointerEvents="none" style={styles.highlight} />
      <View style={padded ? styles.pad : undefined}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: GLASS.radius, borderWidth: 1, borderColor: GLASS.border, overflow: 'hidden' },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: GLASS.background },
  highlight: { position: 'absolute', top: 0, left: GLASS.radius / 2, right: GLASS.radius / 2, height: 1, backgroundColor: GLASS.highlight },
  pad: { padding: 16 },
});
