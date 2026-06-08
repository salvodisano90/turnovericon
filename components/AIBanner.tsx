// components/AIBanner.tsx

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

interface Props {
  ok: boolean;
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
}

export default function AIBanner({ ok, title, subtitle, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  const base = ok ? colors.green : colors.blue;
  return (
    <Animated.View entering={FadeIn.duration(220)} style={[styles.banner, { backgroundColor: base }]}>
      <View style={styles.spark}>
        <Icon name="sparkles" size={22} color="#fff" />
      </View>
      <View style={styles.tx}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>
      <Pressable style={styles.btn} onPress={onAction}>
        <Text style={[styles.btnTxt, { color: base }]}>{actionLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  spark: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  tx: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sub: { color: '#fff', opacity: 0.92, fontSize: 12.5, marginTop: 1 },
  btn: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, height: 36, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { fontWeight: '800', fontSize: 14 },
});
