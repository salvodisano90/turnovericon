// components/ScreenHeader.tsx

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../hooks/useStore';
import { MONTHS } from '../utils/constants';

interface ExtraAction {
  icon: string;
  onPress: () => void;
  disabled?: boolean;
}

interface Props {
  title: string;
  actionIcon?: string;
  onAction?: () => void;
  monthNav?: boolean;
  pill?: React.ReactNode;
  extraActions?: ExtraAction[];
}

export default function ScreenHeader({ title, actionIcon, onAction, monthNav = true, pill, extraActions }: Props) {
  const { colors } = useTheme();
  const { month, year, setMonth } = useStore();
  const router = useRouter();
  return (
    <View style={[styles.bar, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => router.push('/assistente')} hitSlop={8} accessibilityLabel="Assistente Coordinatore AI">
            <Icon name="sparkles" size={20} color={colors.blue} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        </View>
        <View style={styles.actions}>
          {extraActions?.map((a, i) => (
            <Pressable key={i} style={[styles.action, { backgroundColor: colors.card2, opacity: a.disabled ? 0.4 : 1 }]} onPress={a.disabled ? undefined : a.onPress} hitSlop={6}>
              <Icon name={a.icon} size={18} color={colors.blue} />
            </Pressable>
          ))}
          {actionIcon && onAction ? (
            <Pressable style={[styles.action, { backgroundColor: colors.card2 }]} onPress={onAction} hitSlop={8}>
              <Icon name={actionIcon} size={20} color={colors.blue} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {(monthNav || pill) && (
        <View style={styles.sub}>
          {monthNav ? (
            <View style={[styles.msw, { backgroundColor: colors.bg }]}>
              <Pressable style={styles.mswBtn} onPress={() => setMonth(-1)} hitSlop={6}>
                <Icon name="chevron-back" size={18} color={colors.blue} />
              </Pressable>
              <Text style={[styles.mswLabel, { color: colors.text }]}>{MONTHS[month]} {year}</Text>
              <Pressable style={styles.mswBtn} onPress={() => setMonth(1)} hitSlop={6}>
                <Icon name="chevron-forward" size={18} color={colors.blue} />
              </Pressable>
            </View>
          ) : <View />}
          {pill}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 50, paddingHorizontal: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  action: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sub: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, gap: 10 },
  msw: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 20, padding: 3 },
  mswBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  mswLabel: { fontSize: 14, fontWeight: '700', minWidth: 120, textAlign: 'center' },
});
