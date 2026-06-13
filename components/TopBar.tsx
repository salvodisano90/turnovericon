// components/TopBar.tsx — Top bar condivisa: [reparto] · [titolo] · [campanella+avatar].
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../hooks/useStore';
import { useAuth } from '../hooks/useAuth';
import PressableScale from './PressableScale';
import Icon from './Icon';

const initials = (n?: string, c?: string) => `${(n || '').trim()[0] || ''}${(c || '').trim()[0] || ''}`.toUpperCase();

export default function TopBar({ title }: { title: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { ctx, requests } = useStore();
  const { user } = useAuth();
  const reparto = ctx.reparti[0]?.nome || 'Nessun reparto';
  const pending = (requests || []).filter((r: any) => r.stato === 'inviata' || r.stato === 'pending').length;
  const ini = user ? initials(user.nome, user.cognome) : '';

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6, backgroundColor: colors.bg, borderBottomColor: colors.separator }]}>
      <Text style={[styles.reparto, { color: colors.text3 }]} numberOfLines={1}>{reparto}</Text>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
      <View style={styles.right}>
        <PressableScale onPress={() => router.push('/notifiche')} hitSlop={8} style={styles.iconBtn}>
          <Icon name="notifications-outline" size={22} color={colors.text} />
          {pending > 0 ? <View style={[styles.badge, { backgroundColor: colors.red }]}><Text style={styles.badgeTxt}>{pending > 9 ? '9+' : pending}</Text></View> : null}
        </PressableScale>
        <PressableScale onPress={() => router.push('/account-hub')} hitSlop={8} style={[styles.avatar, { backgroundColor: user ? colors.blue : colors.card2 }]}>
          {user ? <Text style={styles.avatarTxt}>{ini}</Text> : <Icon name="person" size={20} color={colors.text3} />}
        </PressableScale>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  reparto: { fontSize: 12, fontWeight: '700', maxWidth: 90 },
  title: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 90, justifyContent: 'flex-end' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
