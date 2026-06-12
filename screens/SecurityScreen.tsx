// screens/SecurityScreen.tsx — Sicurezza account (mock architetturale, pronto per backend).
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import SectionTitle from '../components/SectionTitle';
import Icon from '../components/Icon';

export default function SecurityScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, session } = useAuth();

  const Row = ({ k, v }: { k: string; v: string }) => (
    <View style={styles.row}><Text style={[styles.k, { color: colors.text3 }]}>{k}</Text><Text style={[styles.v, { color: colors.text }]}>{v}</Text></View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Sicurezza" subtitle="Accesso e dispositivi" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <SectionTitle>Account</SectionTitle>
        <GlassCard>
          <Row k="Email" v={user?.email || '—'} />
          <Row k="Password" v="••••••••" />
          <Button title="Cambia password" small variant="secondary" icon="alert-circle-outline" onPress={() => router.push('/recupero-password')} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
        </GlassCard>

        <SectionTitle>Sessione</SectionTitle>
        <GlassCard>
          <Row k="Stato" v={session ? 'Attiva' : 'Non autenticato'} />
          <Row k="Ricordami" v={session?.remember ? 'Sì' : 'No'} />
        </GlassCard>

        <SectionTitle>Dispositivi collegati</SectionTitle>
        <GlassCard>
          <View style={styles.dev}>
            <Icon name="home" size={18} color={colors.text2} />
            <View style={{ flex: 1 }}><Text style={[styles.devName, { color: colors.text }]}>Questo dispositivo</Text><Text style={[styles.devMeta, { color: colors.text3 }]}>Sessione corrente</Text></View>
            <Text style={[styles.badge, { color: colors.green }]}>● attivo</Text>
          </View>
          <Text style={[styles.note, { color: colors.text3 }]}>L'elenco completo dei dispositivi sarà disponibile dopo l'attivazione del backend.</Text>
        </GlassCard>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  k: { fontSize: 13 }, v: { fontSize: 15, fontWeight: '700' },
  dev: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  devName: { fontSize: 15, fontWeight: '700' }, devMeta: { fontSize: 12.5, marginTop: 1 },
  badge: { fontSize: 12.5, fontWeight: '700' },
  note: { fontSize: 12, marginTop: 10, lineHeight: 17 },
});
