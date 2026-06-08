// screens/StaffDashboardScreen.tsx — home semplice per lo STAFF (sola consultazione).
// Mostra solo: I miei turni, Calendario, Le mie richieste, Nuova richiesta, Profilo.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import GlassCard from '../components/GlassCard';
import PressableScale from '../components/PressableScale';
import Avatar from '../components/Avatar';

export default function StaffDashboardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, currentEmail, members, requests } = useStore();

  const me = (members || []).find((m) => (m.email || '').toLowerCase() === (currentEmail || '').toLowerCase());
  const displayName = me && me.nome ? me.nome.split(' ')[0] : 'Operatore';
  const myReq = (requests || []).filter((r) => me && (r.infId === me.infId));
  const pending = myReq.filter((r) => r.stato === 'pending').length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';

  const ITEMS = [
    { lbl: 'I miei turni', icon: 'calendar-number-outline', to: '/' , sub: 'Il tuo calendario' },
    { lbl: 'Le mie richieste', icon: 'list-outline', to: '/richieste', sub: myReq.length ? `${myReq.length} totali · ${pending} in attesa` : 'Nessuna' },
    { lbl: 'Nuova richiesta', icon: 'add-circle-outline', to: '/desiderata', sub: 'Ferie, desiderata, indisponibilità' },
    { lbl: 'Profilo', icon: 'person-circle-outline', to: '/profilo', sub: 'Account e avatar' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.hello, { color: colors.text2 }]}>{greeting}</Text>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.role, { color: colors.text3 }]}>Accesso Staff · sola consultazione</Text>
        </View>
        <PressableScale onPress={() => router.push('/profilo')}>
          <Avatar nome={me && me.nome ? me.nome : 'Operatore'} ruolo="Infermiere" size={52} config={profile} />
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {ITEMS.map((it) => (
          <PressableScale key={it.lbl} onPress={() => router.push(it.to as any)} style={{ marginBottom: 12 }}>
            <GlassCard style={styles.item}>
              <View style={[styles.icon, { backgroundColor: colors.blueSoft }]}><Icon name={it.icon as any} size={22} color={colors.blue} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemLbl, { color: colors.text }]}>{it.lbl}</Text>
                <Text style={[styles.itemSub, { color: colors.text3 }]}>{it.sub}</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.text3} />
            </GlassCard>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingBottom: 8 },
  hello: { fontSize: 15, fontWeight: '600' },
  name: { fontSize: 32, fontWeight: '800' },
  role: { fontSize: 12.5, marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemLbl: { fontSize: 16, fontWeight: '700' },
  itemSub: { fontSize: 12.5, marginTop: 2 },
});
