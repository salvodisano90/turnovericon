// components/NotificationBadge.tsx — campanella con badge rosso (numero non lette).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import PressableScale from './PressableScale';
import Icon from './Icon';

export default function NotificationBadge({ count, onPress }: { count: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} hitSlop={8} style={styles.btn}>
      <Icon name="notifications-outline" size={22} color={colors.text} />
      {count > 0 ? <View style={[styles.badge, { backgroundColor: colors.red }]}><Text style={styles.txt}>{count > 9 ? '9+' : count}</Text></View> : null}
    </PressableScale>
  );
}
const styles = StyleSheet.create({
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  txt: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
