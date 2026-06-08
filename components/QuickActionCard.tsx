// components/QuickActionCard.tsx — card azione rapida (icona + titolo + sottotitolo), tappabile.
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import PressableScale from './PressableScale';
import Icon from './Icon';

export default function QuickActionCard({ icon, title, subtitle, onPress, badge, style }: {
  icon: string; title: string; subtitle?: string; onPress: () => void; badge?: number; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} style={styles.flex}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }, style]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.blueSoft }]}>
          <Icon name={icon} size={20} color={colors.blue} />
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
  card: { flex: 1, borderRadius: 24, borderWidth: 1, padding: 18, minHeight: 116 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  title: { fontSize: 15.5, fontWeight: '800' },
  sub: { fontSize: 12.5, marginTop: 3, lineHeight: 17 },
});
