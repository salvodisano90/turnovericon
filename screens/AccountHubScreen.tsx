// screens/AccountHubScreen.tsx — Account Hub premium: header 96px + card azione grandi (icona/titolo/descrizione/freccia).
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
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
  const toast = useToast();

  const ActionCard = ({ icon, title, desc, onPress, danger }: { icon: string; title: string; desc: string; onPress: () => void; danger?: boolean }) => (
    <PressableScale onPress={onPress}>
      <View style={[styles.action, { backgroundColor: colors.card, borderColor: colors.line }]}>
        <View style={[styles.actionIcon, { backgroundColor: danger ? colors.red + '22' : colors.blueSoft }]}>
          <Icon name={icon} size={20} color={danger ? colors.red : colors.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.actionTitle, { color: danger ? colors.red : colors.text }]}>{title}</Text>
          <Text style={[styles.actionDesc, { color: colors.text3 }]} numberOfLines={1}>{desc}</Text>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.text3} />
      </View>
    </PressableScale>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Account" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        {user ? (
          <>
            <GlassCard style={{ alignItems: 'center', paddingVertical: 26, marginBottom: 16 }}>
              <View style={[styles.avatar, { backgroundColor: colors.blue }]}><Text style={styles.avatarTxt}>{initials(user.nome, user.cognome)}</Text></View>
              <Text style={[styles.name, { color: colors.text }]}>{user.nome}{user.cognome ? ` ${user.cognome}` : ''}</Text>
              <Text style={[styles.mail, { color: colors.text2 }]}>{user.email}</Text>
              <View style={[styles.roleChip, { backgroundColor: colors.blueSoft }]}><Text style={[styles.roleTxt, { color: colors.blue }]}>{user.role === 'OWNER' ? 'Coordinatore' : 'Staff'}</Text></View>
              <Text style={[styles.lastAccess, { color: colors.text3 }]}>Sessione attiva</Text>
            </GlassCard>

            <GlassCard style={{ marginBottom: 16 }}>
              <Text style={[styles.sysTitle, { color: colors.text3 }]}>SISTEMA</Text>
              <View style={styles.sysRow}><Text style={[styles.sysK, { color: colors.text3 }]}>Archiviazione</Text><Text style={[styles.sysV, { color: colors.text }]}>Locale · questo dispositivo</Text></View>
              <View style={styles.sysRow}><Text style={[styles.sysK, { color: colors.text3 }]}>Sincronizzazione</Text><Text style={[styles.sysV, { color: colors.text }]}>Non attiva (backend assente)</Text></View>
              <View style={styles.sysRow}><Text style={[styles.sysK, { color: colors.text3 }]}>Audit log</Text><Text style={[styles.sysV, { color: colors.text }]}>Attivo · locale</Text></View>
              <View style={styles.sysRow}><Text style={[styles.sysK, { color: colors.text3 }]}>AI</Text><Text style={[styles.sysV, { color: colors.text }]}>Motore deterministico · LLM non collegato</Text></View>
              <View style={[styles.sysRow, { borderBottomWidth: 0 }]}><Text style={[styles.sysK, { color: colors.text3 }]}>Privacy</Text><Text style={[styles.sysV, { color: colors.text }]}>Dati solo su questo dispositivo</Text></View>
            </GlassCard>

            <ActionCard icon="person-circle-outline" title="Profilo" desc="Nome, avatar e dati personali" onPress={() => router.push('/profilo')} />
            <ActionCard icon="alert-circle-outline" title="Sicurezza" desc="Password e accesso" onPress={() => router.push('/sicurezza')} />
            <ActionCard icon="notifications-outline" title="Notifiche" desc="Richieste e avvisi" onPress={() => router.push('/notifiche')} />
            <ActionCard icon="home" title="Dispositivi collegati" desc="Sessioni attive" onPress={() => router.push('/sicurezza')} />
            <ActionCard icon="save-outline" title="Backup e sincronizzazione" desc="Disponibile dopo l'attivazione del backend" onPress={() => toast.show('Backup disponibile quando il backend sarà attivo', 'info')} />
            <ActionCard icon="sparkles-outline" title="Abbonamento" desc="Piano e fatturazione" onPress={() => toast.show('Gestione abbonamento in arrivo', 'info')} />
            <ActionCard icon="log-out-outline" title="Esci" desc="Disconnetti questo account" danger onPress={async () => { await signOut(); router.replace('/'); }} />
          </>
        ) : (
          <>
            <GlassCard style={{ alignItems: 'center', paddingVertical: 28, marginBottom: 16 }}>
              <View style={[styles.avatar, { backgroundColor: colors.card2 }]}><Icon name="person" size={36} color={colors.text3} /></View>
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
  sysTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  sysRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  sysK: { fontSize: 13, fontWeight: '500' },
  sysV: { fontSize: 13, fontWeight: '600', maxWidth: '62%', textAlign: 'right' },
  root: { flex: 1 },
  avatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarTxt: { color: '#fff', fontSize: 36, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800' },
  mail: { fontSize: 14, marginTop: 4 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, marginTop: 10 },
  roleTxt: { fontSize: 13, fontWeight: '700' },
  lastAccess: { fontSize: 12, marginTop: 8 },
  guestSub: { fontSize: 13.5, textAlign: 'center', marginTop: 6, lineHeight: 19, paddingHorizontal: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 90, borderRadius: 24, borderWidth: 1, paddingHorizontal: 16, marginBottom: 12 },
  actionIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 16, fontWeight: '800' },
  actionDesc: { fontSize: 13, marginTop: 2 },
});
