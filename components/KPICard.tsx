// components/KPICard.tsx — KPI premium: icona, valore grande, descrizione, trend/stato. Altezza 160, radius 28.
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import CountUpText from './CountUpText';
import PressableScale from './PressableScale';
import Icon from './Icon';

export default function KPICard({ icon, label, value, sub, subColor, trend, trendColor, onPress, style }: {
  icon?: string; label: string; value: string; sub?: string; subColor?: string;
  trend?: string; trendColor?: string; onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const body = (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }, style]}>
      <View style={styles.top}>
        {icon ? <View style={[styles.iconWrap, { backgroundColor: colors.blueSoft }]}><Icon name={icon} size={20} color={colors.blue} /></View> : <View />}
        {trend ? <View style={[styles.chip, { backgroundColor: (trendColor || colors.green) + '22' }]}><Text style={[styles.chipTxt, { color: trendColor || colors.green }]}>{trend}</Text></View> : null}
      </View>
      <CountUpText value={value} style={[styles.value, { color: colors.text }]} />
      <Text style={[styles.label, { color: colors.text3 }]} numberOfLines={1}>{label}</Text>
      {sub ? <Text style={[styles.sub, { color: subColor || colors.text2 }]} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
  return onPress ? <PressableScale onPress={onPress} style={styles.flex}>{body}</PressableScale> : body;
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { flex: 1, borderRadius: 24, borderWidth: 1, padding: 18, minHeight: 160, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9 },
  chipTxt: { fontSize: 12, fontWeight: '800' },
  value: { fontSize: 40, fontWeight: '800', marginTop: 8 },
  label: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  sub: { fontSize: 12.5, fontWeight: '700', marginTop: 1 },
});
