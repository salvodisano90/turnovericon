// screens/BancaOreScreen.tsx — Banca ore per operatore (P2) + ferie residue (P3). Export CSV reale.
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import { hoursBank } from '../services/hoursBank';
import { ferieBalance } from '../services/ferie';
import { shareOrDownloadText } from '../utils/platformShare';

export default function BancaOreScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { ctx, currentPiano, year } = useStore();

  const rows = useMemo(() => hoursBank(ctx, currentPiano || {}), [ctx, currentPiano]);
  const ferie = useMemo(() => { const m: Record<string, number> = {}; ferieBalance(ctx.staff, ctx.ferie, year).forEach((f) => (m[f.infId] = f.residue)); return m; }, [ctx.staff, ctx.ferie, year]);

  const exportCsv = async () => {
    try {
      const head = 'Operatore;Ore contrattuali;Ore lavorate;Saldo;Straordinari;Debito;Notti;Festivi;Ferie residue';
      const body = rows.map((r) => [r.nome, r.oreContrattuali, r.oreLavorate, r.saldo, r.straordinari, r.debito, r.notti, r.festivi, ferie[r.infId] ?? ''].join(';')).join('\n');
      await shareOrDownloadText('banca-ore.csv', head + '\n' + body, 'text/csv');
      toast.show('Banca ore esportata (CSV)', 'success');
    } catch { toast.show('Export non riuscito su questo dispositivo', 'error'); }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Banca ore" subtitle="Ore, straordinari, notti, festivi e ferie residue" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      {rows.length ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <Button title="Esporta CSV" full icon="download-outline" variant="secondary" onPress={exportCsv} style={{ marginBottom: 12 }} />
          {rows.map((r) => (
            <GlassCard key={r.infId} style={{ marginBottom: 10 }}>
              <View style={styles.rowTop}>
                <Text style={[styles.nome, { color: colors.text }]} numberOfLines={1}>{r.nome}</Text>
                <Text style={[styles.saldo, { color: r.saldo >= 0 ? colors.green : colors.red }]}>{r.saldo >= 0 ? '+' : ''}{r.saldo}h</Text>
              </View>
              <View style={styles.grid}>
                {[
                  ['Contrattuali', `${r.oreContrattuali}h`], ['Lavorate', `${r.oreLavorate}h`],
                  ['Straordinari', `${r.straordinari}h`], ['Debito', `${r.debito}h`],
                  ['Notti', `${r.notti}`], ['Festivi', `${r.festivi}`],
                  ['Ferie residue', `${ferie[r.infId] ?? '—'}`], ['Assenze', `${r.assenze}`],
                ].map(([k, val]) => (
                  <View key={k} style={styles.cell}><Text style={[styles.k, { color: colors.text3 }]}>{k}</Text><Text style={[styles.v, { color: colors.text }]}>{val}</Text></View>
                ))}
              </View>
            </GlassCard>
          ))}
        </ScrollView>
      ) : <EmptyState icon="time-outline" title="Nessun dato" desc="Aggiungi personale e genera i turni per vedere la banca ore." />}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  nome: { fontSize: 16, fontWeight: '800', flex: 1 },
  saldo: { fontSize: 16, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '25%', paddingVertical: 4 },
  k: { fontSize: 11 },
  v: { fontSize: 15, fontWeight: '700', marginTop: 1 },
});
