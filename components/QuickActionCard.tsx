// components/QuickActionCard.tsx — card azione rapida (icona + titolo + sottotitolo), tappabile.
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import PressableScale from './PressableScale';
import Icon from './Icon';

export default function QuickActionCard({ icon, title, subtitle, onPress, badge, style, color }: {
  icon: string; title: string; subtitle?: string; onPress: () => void; badge?: number; style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} style={styles.flex}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }, style]}>
        <View style={[styles.iconWrap, { backgroundColor: (color || colors.blue) + '22' }]}>
          <Icon name={icon} size={28} color={color || colors.blue} />
          {badge ? <View style={[styles.badge, { backgroundColor: colors.red }]}><Text style={styles.badgeTxt}>{badge > 9 ? '9+' : badge}</Text></View> : null}
        </View>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.sub, { color: colors.text3 }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
    </PressableScale>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { flex: 1, borderRadius: 24, borderWidth: 1, padding: 16, height: 116, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  title: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 12, marginTop: 2, lineHeight: 16, textAlign: 'center' },
});
