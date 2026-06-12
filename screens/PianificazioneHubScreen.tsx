import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AREA } from '../utils/designSystem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppShell from '../components/AppShell';
import QuickActionCard from '../components/QuickActionCard';
import SectionTitle from '../components/SectionTitle';

export default function PianificazioneHubScreen() {
  const insets = useSafeAreaInsets();
  return (
    <AppShell title="Pianificazione">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        <SectionTitle>Turni</SectionTitle>
        <View style={styles.row}>
          <QuickActionCard icon="sparkles-outline" title="Genera Turni" subtitle="Piano mensile automatico" onPress={() => router.push('/turni')} color={AREA.pianificazione} />
          <QuickActionCard icon="grid-outline" title="Matrici" subtitle="Cicli del personale" onPress={() => router.push('/matrici')} color={AREA.pianificazione} />
        </View>
        <View style={styles.row}>
          <QuickActionCard icon="sunny" title="Matrici Stagionali" subtitle="Cicli per stagione" onPress={() => router.push('/matrici-stagionali')} color={AREA.pianificazione} />
          <QuickActionCard icon="flask-outline" title="Simulatore" subtitle="Test scenario" onPress={() => router.push('/simulatore')} color={AREA.pianificazione} />
        </View>
        <SectionTitle>Configurazione</SectionTitle>
        <View style={styles.row}>
          <QuickActionCard icon="business-outline" title="Reparti" subtitle="Orari e copertura minima" onPress={() => router.push('/reparti')} color={AREA.pianificazione} />
          <View style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </AppShell>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 12, marginBottom: 12 } });
