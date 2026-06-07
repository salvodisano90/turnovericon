// screens/AccountHubScreen.tsx — Account Hub (dal tap sull'avatar in alto a destra). Stile bottom-sheet iOS.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import PressableScale from '../components/PressableScale';
import Icon from '../components/Icon';

const initials = (n?: string, c?: string) => `${(n || '').trim()[0] || ''}${(c || '').trim()[0] || ''}`.toUpperCase() || '?';

export default function AccountHubScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const Action = ({ icon, label, onPress, danger }: any) => (
    <PressableScale onPress={onPress}>
      <View style={[styles.action, { borderColor: colors.separator }]}>
        <Icon name={icon} size={18} color={danger ? colors.red : colors.text2} />
        <Text style={[styles.actionTxt, { color: danger ? colors.red : colors.text }]}>{label}</Text>
        <Icon name="chevron-forward" size={16} color={colors.text3} />
      </View>
    </PressableScale>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Account" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {user ? (
          <>
            <GlassCard style={{ alignItems: 'center', paddingVertical: 22, marginBottom: 14 }}>
              <View style={[styles.avatar, { backgroundColor: colors.blue }]}><Text style={styles.avatarTxt}>{initials(user.nome, user.cognome)}</Text></View>
              <Text style={[styles.name, { color: colors.text }]}>{user.nome}{user.cognome ? ` ${user.cognome}` : ''}</Text>
              <Text style={[styles.role, { color: colors.text2 }]}>{user.role === 'OWNER' ? 'Coordinatore' : 'Staff'}</Text>
              <Text style={[styles.mail, { color: colors.text3 }]}>{user.email}</Text>
            </GlassCard>
            <Action icon="person-circle-outline" label="Profilo" onPress={() => router.push('/profilo')} />
            <Action icon="alert-circle-outline" label="Sicurezza" onPress={() => router.push('/sicurezza')} />
            <Action icon="people-outline" label="Gestione accessi" onPress={() => router.push('/utenti-autorizzati')} />
            <Action icon="log-out-outline" label="Esci" danger onPress={async () => { await signOut(); router.back(); }} />
          </>
        ) : (
          <>
            <GlassCard style={{ alignItems: 'center', paddingVertical: 24, marginBottom: 14 }}>
              <View style={[styles.avatar, { backgroundColor: colors.card2 }]}><Icon name="person" size={30} color={colors.text3} /></View>
              <Text style={[styles.name, { color: colors.text }]}>Ospite</Text>
              <Text style={[styles.guestSub, { color: colors.text2 }]}>Accedi per sincronizzare i dati e collaborare con il tuo reparto</Text>
            </GlassCard>
            <Button title="Accedi" full icon="log-in-outline" onPress={() => router.push('/login')} />
            <Button title="Registrati" full variant="secondary" onPress={() => router.push('/registrazione')} style={{ marginTop: 10 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarTxt: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800' },
  role: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  mail: { fontSize: 13, marginTop: 4 },
  guestSub: { fontSize: 13.5, textAlign: 'center', marginTop: 6, lineHeight: 19, paddingHorizontal: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  actionTxt: { fontSize: 16, fontWeight: '600', flex: 1 },
});
