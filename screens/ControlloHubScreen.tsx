import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppShell from '../components/AppShell';
import QuickActionCard from '../components/QuickActionCard';

export default function ControlloHubScreen() {
  const insets = useSafeAreaInsets();
  return (
    <AppShell title="Controllo">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        <View style={styles.row}>
          <QuickActionCard icon="alert-circle-outline" title="Centro Criticità" subtitle="Scoperture e problemi" onPress={() => router.push('/centro-criticita')} />
          <QuickActionCard icon="stats-chart-outline" title="Dashboard Direzione" subtitle="KPI e performance" onPress={() => router.push('/direzione')} />
        </View>
        <View style={styles.row}>
          <QuickActionCard icon="time-outline" title="Banca Ore" subtitle="Straordinari e residui" onPress={() => router.push('/banca-ore')} />
          <QuickActionCard icon="list-outline" title="Postazioni" subtitle="Copertura e fabbisogni" onPress={() => router.push('/postazioni')} />
        </View>
        <View style={styles.row}>
          <QuickActionCard icon="pulse" title="Copertura" subtitle="Andamento del mese" onPress={() => router.push('/copertura')} />
          <QuickActionCard icon="save-outline" title="Report / Export" subtitle="PDF ed Excel" onPress={() => router.push('/report')} />
        </View>
      </ScrollView>
    </AppShell>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 12, marginBottom: 12 } });
