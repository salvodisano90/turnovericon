import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AREA } from '../utils/designSystem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import AppShell from '../components/AppShell';
import QuickActionCard from '../components/QuickActionCard';

export default function PersonaleHubScreen() {
  const insets = useSafeAreaInsets();
  const { requests } = useStore();
  const pending = (requests || []).filter((r: any) => r.stato === 'inviata' || r.stato === 'pending').length;
  return (
    <AppShell title="Personale">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        <View style={styles.row}>
          <QuickActionCard icon="people-outline" title="Personale" subtitle="Anagrafica operatori" onPress={() => router.push('/personale-lista')} color={AREA.personale} />
          <QuickActionCard icon="sunny" title="Ferie e assenze" subtitle="Inserisci e gestisci" onPress={() => router.push('/ferie-wizard')} color={AREA.ferie} />
        </View>
        <View style={styles.row}>
          <QuickActionCard icon="mail-outline" title="Richieste" subtitle="Permessi e ferie" badge={pending || undefined} onPress={() => router.push('/richieste')} color={AREA.richieste} />
          <QuickActionCard icon="heart" title="Desiderata" subtitle="Preferenze del personale" onPress={() => router.push('/desiderata')} color={AREA.desiderate} />
        </View>
        <View style={styles.row}>
          <QuickActionCard icon="download-outline" title="Import Personale" subtitle="Import massivo" onPress={() => router.push('/import-personale')} color={AREA.personale} />
          <QuickActionCard icon="call-outline" title="Reperibilità" subtitle="Pronta disponibilità" onPress={() => router.push('/reperibilita')} color={AREA.reperibilita} />
        </View>
        <View style={styles.row}>
          <QuickActionCard icon="person-circle-outline" title="Accessi" subtitle="Utenti autorizzati" onPress={() => router.push('/utenti-autorizzati')} color={AREA.account} />
          <View style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </AppShell>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 12, marginBottom: 12 } });
