// screens/DirezioneScreen.tsx — Dashboard direzionale (P4): copertura, criticità normative,
// straordinari, ferie residue, notti, festivi, banca ore. Export CSV riepilogo.
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
import SectionTitle from '../components/SectionTitle';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { computeCoverage } from '../services/engine';
import { complianceReport } from '../services/compliance';
import { hoursBank } from '../services/hoursBank';
import { ferieBalance } from '../services/ferie';
import { shareOrDownloadText } from '../utils/platformShare';

export default function DirezioneScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { ctx, currentPiano, year } = useStore();
  const piano = currentPiano || {};

  const data = useMemo(() => {
    const cov = computeCoverage(ctx, piano).globalPct;
    const comp = complianceReport(ctx, piano);
    const hb = hoursBank(ctx, piano);
    const fb = ferieBalance(ctx.staff, ctx.ferie, year);
    const straord = Math.round(hb.reduce((a, r) => a + r.straordinari, 0));
    const notti = hb.reduce((a, r) => a + r.notti, 0);
    const festivi = hb.reduce((a, r) => a + r.festivi, 0);
    const ferieResidue = fb.reduce((a, r) => a + r.residue, 0);
    return { cov, viol: comp.violazioni.length, perRegola: comp.perRegola, straord, notti, festivi, ferieResidue, hb };
  }, [ctx, piano, year]);

  const exportCsv = async () => {
    try {
      const lines = [
        'Indicatore;Valore',
        `Copertura globale;${data.cov}%`,
        `Violazioni normative;${data.viol}`,
        `Straordinari totali;${data.straord}h`,
        `Notti totali;${data.notti}`,
        `Festivi totali;${data.festivi}`,
        `Ferie residue (somma);${data.ferieResidue}`,
      ];
      await shareOrDownloadText('direzione.csv', lines.join('\n'), 'text/csv');
      toast.show('Riepilogo direzione esportato (CSV)', 'success');
    } catch { toast.show('Export non riuscito su questo dispositivo', 'error'); }
  };

  if (!ctx.staff.length || !ctx.reparti.length) {
    return (<View style={[styles.root, { backgroundColor: colors.bg }]}><SheetHeader title="Direzione" subtitle="Quadro aziendale" onClose={() => router.back()} /><EmptyState icon="stats-chart-outline" title="Dati insufficienti" desc="Configura reparti e personale per il quadro direzionale." /></View>);
  }

  const KPI = [
    { lab: 'Copertura', val: `${data.cov}%`, icon: 'pulse', color: data.cov >= 90 ? colors.green : data.cov >= 70 ? colors.yellow : colors.red },
    { lab: 'Violazioni norm.', val: `${data.viol}`, icon: 'alert-circle', color: data.viol ? colors.red : colors.green },
    { lab: 'Straordinari', val: `${data.straord}h`, icon: 'time', color: colors.text },
    { lab: 'Ferie residue', val: `${data.ferieResidue}`, icon: 'sunny', color: colors.text },
    { lab: 'Notti', val: `${data.notti}`, icon: 'moon', color: colors.text },
    { lab: 'Festivi', val: `${data.festivi}`, icon: 'flag', color: colors.text },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Direzione" subtitle="Quadro aziendale del mese" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.kpiGrid}>
          {KPI.map((k) => (
            <GlassCard key={k.lab} style={styles.kpi}>
              <Icon name={k.icon as any} size={20} color={k.color} />
              <Text style={[styles.kpiVal, { color: k.color }]}>{k.val}</Text>
              <Text style={[styles.kpiLab, { color: colors.text3 }]}>{k.lab}</Text>
            </GlassCard>
          ))}
        </View>

        {data.viol ? (
          <>
            <SectionTitle>Criticità normative</SectionTitle>
            <GlassCard>
              {Object.entries(data.perRegola).filter(([, n]) => (n as number) > 0).map(([r, n]) => (
                <View key={r} style={styles.violRow}><Text style={[styles.violTxt, { color: colors.text2 }]}>{r}</Text><Text style={[styles.violN, { color: colors.red }]}>{n as number}</Text></View>
              ))}
            </GlassCard>
          </>
        ) : null}

        <Button title="Esporta riepilogo (CSV)" full icon="download-outline" variant="secondary" onPress={exportCsv} style={{ marginTop: 14 }} />
        <Button title="Apri banca ore" full icon="time-outline" variant="ghost" onPress={() => router.push('/banca-ore')} style={{ marginTop: 8 }} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: '31%', alignItems: 'center', paddingVertical: 16, gap: 4 },
  kpiVal: { fontSize: 20, fontWeight: '800' },
  kpiLab: { fontSize: 11, textAlign: 'center' },
  violRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  violTxt: { fontSize: 13 },
  violN: { fontSize: 14, fontWeight: '800' },
});
