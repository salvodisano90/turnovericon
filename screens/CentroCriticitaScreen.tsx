// screens/CentroCriticitaScreen.tsx — "sala controllo": KPI giganti + allarmi a card + AI correction.
// Solo presentazione: dati e logica (whyUncovered/proposeAutoFix/applyFix) invariati.
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { matrixFidelity } from '../services/matrixFidelity';
import { useToast } from '../hooks/useToast';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import KPICard from '../components/KPICard';
import Button from '../components/Button';
import SectionTitle from '../components/SectionTitle';
import { whyUncovered, proposeAutoFix, dashboardData, AutoFixSolution } from '../services/engine';

const impColor = (v: string, c: any) => (v === 'alto' || v === 'critico') ? c.red : (v === 'medio' || v === 'attenzione') ? c.yellow : c.green;

export default function CentroCriticitaScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { ctx, currentPiano, applyFix } = useStore();
  const piano = currentPiano || {};

  const why = useMemo(() => whyUncovered(ctx, piano), [ctx, piano]);
  const sols = useMemo(() => proposeAutoFix(ctx, piano), [ctx, piano]);
  const data = useMemo(() => dashboardData(ctx, piano, new Date().getDate()), [ctx, piano]);
  const hasData = ctx.staff.length > 0 || ctx.reparti.length > 0;
  const mf = useMemo(() => { try { return hasData ? matrixFidelity(ctx, piano) : null; } catch { return null; } }, [ctx, piano, hasData]);

  const scoperte = why.postazioniScoperte.length;
  const crit = data.criticita.length;
  const cov = data.coperturaMese;
  const sicurezza = (data.indiceSicurezza && data.indiceSicurezza.score) || 0;

  type Alarm = { level: 'red' | 'yellow' | 'green'; title: string; cause: string; action?: string };
  const alarms: Alarm[] = [];
  why.postazioniScoperte.forEach((p: string) => alarms.push({ level: 'red', title: `Postazione scoperta: ${p}`, cause: 'Copertura insufficiente sul turno', action: 'Valuta richiamo o spostamento' }));
  why.cause.forEach((c: any) => alarms.push({ level: 'red', title: c.nome, cause: c.motivo }));
  why.causeStrutturali.forEach((c: string) => alarms.push({ level: 'yellow', title: 'Criticità strutturale', cause: c }));
  if (!alarms.length) alarms.push({ level: 'green', title: 'Nessun allarme attivo', cause: 'Il piano del mese rispetta i vincoli operativi' });
  const lvlColor = (l: string) => (l === 'red' ? colors.red : l === 'yellow' ? colors.yellow : colors.green);
  const lvlRank: Record<string, number> = { red: 0, yellow: 1, green: 2 };
  const priorita = [...alarms].sort((a, b) => (lvlRank[a.level] ?? 3) - (lvlRank[b.level] ?? 3));

  const onApply = (sol: AutoFixSolution) => { applyFix(sol); toast.show(sol.azione.tipo === 'chiusura' ? 'Postazione chiusa' : 'Correzione applicata al piano', 'success'); };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Centro Criticità" subtitle="Situazione operativa del reparto" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        {!hasData ? (
          <View style={{ borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 24, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Nessun dato disponibile</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text3, textAlign: 'center' }}>Crea reparti e personale per vedere copertura, criticità e indice di sicurezza reali.</Text>
          </View>
        ) : null}
        {/* 4 KPI giganti */}
        {hasData ? (<>
        <View style={styles.kpiRow}>
          <KPICard icon="pulse" label="Copertura" value={`${cov}%`} sub={cov >= 90 ? 'Ottima' : cov >= 70 ? 'Buona' : 'Critica'} subColor={cov >= 90 ? colors.green : cov >= 70 ? colors.yellow : colors.red} />
          <KPICard icon="alert-circle" label="Criticità" value={`${crit}`} sub={crit ? 'Da gestire' : 'Tutto ok'} subColor={crit ? colors.red : colors.green} />
        </View>
        <View style={styles.kpiRow}>
          <KPICard icon="list-outline" label="Postazioni scoperte" value={`${scoperte}`} sub={scoperte ? 'Intervieni' : 'Coperte'} subColor={scoperte ? colors.red : colors.green} />
          <KPICard icon="checkmark" label="Indice sicurezza" value={`${sicurezza}`} sub="/100" subColor={sicurezza >= 80 ? colors.green : sicurezza >= 60 ? colors.yellow : colors.red} />
        </View>
        <View style={styles.kpiRow}>
          <KPICard icon="grid-outline" label="Fedeltà matrice" value={mf ? `${mf.score}` : '—'} sub={mf ? mf.banda : 'In attesa di dati'} subColor={mf ? (mf.score >= 90 ? colors.green : mf.score >= 75 ? colors.blue : mf.score >= 60 ? colors.yellow : colors.red) : colors.text3} />
        </View>

        {/* Allarmi attivi */}
        <SectionTitle>Allarmi attivi</SectionTitle>
        {priorita.map((a, i) => (
          <View key={i} style={[styles.alarm, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <View style={styles.alarmRow}>
              <View style={[styles.dot, { backgroundColor: lvlColor(a.level) }]} />
              <Text style={[styles.alarmTitle, { color: colors.text, flex: 1 }]} numberOfLines={2}>{a.title}</Text>
            </View>
            <Text style={[styles.alarmCause, { color: colors.text2 }]}>{a.cause}</Text>
            {a.action ? <Text style={[styles.alarmAction, { color: lvlColor(a.level) }]}>{a.action}</Text> : null}
          </View>
        ))}

        {/* AI Correction Center */}
        {sols.length ? (
          <>
            <SectionTitle>AI Correction Center</SectionTitle>
            {sols.slice(0, 3).map((sol, i) => (
              <GlassCard key={i} style={{ marginBottom: 12 }}>
                <View style={styles.solTop}>
                  <Text style={[styles.solTitle, { color: colors.text }]} numberOfLines={2}>{sol.titolo}</Text>
                  <Text style={[styles.cov, { color: sol.coperturaDopo >= 90 ? colors.green : colors.yellow }]}>{sol.coperturaPrima}% → {sol.coperturaDopo}%</Text>
                </View>
                <Text style={[styles.solDesc, { color: colors.text3 }]}>{sol.descrizione}</Text>
                <View style={styles.chips}>
                  {[['equità', sol.impattoEquita], ['fatigue', sol.impattoFatigue], ['costo', sol.impattoEconomico], ['legale', sol.rischioLegale]].map(([k, v]) => (
                    <View key={k} style={[styles.chip, { backgroundColor: impColor(v, colors) + '22' }]}><Text style={[styles.chipTxt, { color: impColor(v, colors) }]}>{k} {v}</Text></View>
                  ))}
                </View>
                <Button title="Applica" full icon="checkmark-outline" onPress={() => onApply(sol)} style={{ marginTop: 12 }} />
              </GlassCard>
            ))}
          </>
        ) : null}
        </>) : null}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  alarm: { borderRadius: 24, borderWidth: 1, borderLeftWidth: 5, padding: 16, marginBottom: 10 },
  alarmRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  alarmTitle: { fontSize: 15.5, fontWeight: '800' },
  alarmCause: { fontSize: 13.5, marginTop: 6, lineHeight: 19, marginLeft: 20 },
  alarmAction: { fontSize: 13, fontWeight: '700', marginTop: 6, marginLeft: 20 },
  solTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  solTitle: { fontSize: 15.5, fontWeight: '800', flex: 1 },
  cov: { fontSize: 14, fontWeight: '800' },
  solDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9 },
  chipTxt: { fontSize: 11.5, fontWeight: '700' },
});
