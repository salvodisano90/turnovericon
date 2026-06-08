// screens/ReportScreen.tsx

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { listDeroghe, matrixReport, MatriceOrigine } from '../services/engine';
import { exportPianoPDF } from '../services/pdf';
import { simulateRange, SimResult } from '../services/analytics';
import { monthlyHours, annualHours } from '../services/hours';
import { exportPianoXLSX } from '../services/xlsx';
import { MonthlyHours, AnnualHours } from '../types';
import { DEROGA_LABEL } from '../utils/constants';
import { getRep } from '../utils/helpers';
import { DerogaCode } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import Card from '../components/Card';
import SectionTitle from '../components/SectionTitle';
import Button from '../components/Button';

export default function ReportScreen() {
  const { colors, mode, toggle } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { reparti, staff, currentPiano, coverage, ctx, month, year } = useStore();
  const [sim, setSim] = useState<SimResult | null>(null);
  const [annual, setAnnual] = useState<AnnualHours | null>(null);

  const deroghe = useMemo(() => listDeroghe(ctx, currentPiano), [ctx, currentPiano]);
  const mh = useMemo<MonthlyHours>(() => monthlyHours(ctx, currentPiano), [ctx, currentPiano]);
  const mr = useMemo(() => matrixReport(ctx, currentPiano), [ctx, currentPiano]);
  const ORIGINE_UI: Record<MatriceOrigine, string> = { operatore: 'operatore', reparto: 'reparto', mese: 'mese', auto: 'automatica' };

  const DEROGA_MOTIVO_UI: Record<string, string> = {
    ore: 'Oltre il monte ore (straordinario)', notti: 'Oltre la quota notti mensile', consec: 'Oltre i 6 giorni consecutivi',
    weekend: 'Weekend assegnato in esenzione', festivo: 'Festivo assegnato in esenzione',
    preferenza: 'Preferenza non rispettata', desiderata: 'Desiderata non rispettato',
  };
  const derogheRows = useMemo(() => {
    const rows: { nome: string; day: number; rep: string; tipo: string; motivo: string }[] = [];
    staff.forEach((s) => {
      const p = currentPiano[s.id];
      if (!p) return;
      Object.keys(p).forEach((dk) => {
        const d = Number(dk);
        const c = p[d];
        if (c && c.deroghe && c.deroghe.length) {
          const rep = c.repartoId ? (getRep(reparti, c.repartoId)?.nome || '—') : '—';
          (c.deroghe || []).forEach((code: DerogaCode) => rows.push({ nome: s.nome, day: d, rep, tipo: DEROGA_LABEL[code], motivo: DEROGA_MOTIVO_UI[code] || code }));
        }
      });
    });
    return rows.sort((a, b) => a.day - b.day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, currentPiano, reparti]);

  const uncByRep = useMemo(() => {
    const m: Record<string, number> = {};
    coverage.uncovered.forEach((u) => { m[u.repId] = (m[u.repId] || 0) + 1; });
    return m;
  }, [coverage]);

  const doExport = async () => {
    try {
      await exportPianoPDF(ctx, currentPiano);
    } catch {
      toast.show('Esportazione PDF non riuscita', 'error');
    }
  };

  if (!reparti.length || !staff.length) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.bg }]}>
        <ScreenHeader title="Report" actionIcon={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} onAction={toggle} monthNav />
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState
            icon="bar-chart-outline"
            title="Report non disponibile"
            desc="Servono reparti e personale per generare statistiche e report."
            actionLabel="Vai ai reparti"
            onAction={() => router.push('/reparti')}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const runSim = (m: number) => {
    const r = simulateRange(ctx, year, month, m);
    setSim(r);
  };

  const runAnnual = (m: number) => {
    setAnnual(annualHours(ctx, year, month, m));
  };

  const doExportXLSX = async () => {
    try {
      await exportPianoXLSX(ctx, currentPiano);
      toast.show('Excel esportato (foglio Riepilogo + Assenze incluso)', 'success');
    } catch (e) {
      toast.show('Export Excel non riuscito su questo dispositivo', 'error');
    }
  };

  const kpis: { val: string; lab: string; color: string }[] = [
    { val: `${coverage.globalPct}%`, lab: 'Copertura globale', color: coverage.globalPct >= 90 ? colors.green : coverage.globalPct >= 70 ? colors.yellow : colors.red },
    { val: `${coverage.uncovered.length}`, lab: 'Turni scoperti', color: coverage.uncovered.length ? colors.red : colors.green },
    { val: `${deroghe.length}`, lab: 'Deroghe/Straord.', color: deroghe.length ? colors.yellow : colors.text },
    { val: `${staff.length}`, lab: 'Membri staff', color: colors.text },
  ];

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Report" actionIcon={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} onAction={toggle} monthNav />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <Card key={k.lab} style={styles.kpiCard}>
              <Text style={[styles.kpiVal, { color: k.color }]}>{k.val}</Text>
              <Text style={[styles.kpiLab, { color: colors.text2 }]}>{k.lab}</Text>
            </Card>
          ))}
        </View>

        {mr.perOp.length ? (
          <>
            <SectionTitle>Aderenza alla Matrice</SectionTitle>
            <Card>
              <View style={styles.adhTop}>
                <Text style={[styles.adhBig, { color: mr.aderenzaPct >= 90 ? colors.green : colors.yellow }]}>{mr.aderenzaPct}%</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: colors.text }]}>Giorni che derivano dalla matrice</Text>
                  <Text style={[styles.rowSub, { color: colors.text2 }]}>{mr.giorniModificati} modificati · {mr.giorniAssenza} assenze (escluse)</Text>
                </View>
              </View>
              <View style={styles.chips}>
                {Object.keys(mr.byMatrice).map((id) => (
                  <Text key={id} style={[styles.mxChip, { color: colors.text2, backgroundColor: colors.card2 }]}>{id}: {mr.byMatrice[id]}</Text>
                ))}
              </View>
              <View style={styles.chips}>
                {Object.keys(mr.byOrigine).map((o) => (
                  <Text key={o} style={[styles.mxChip, { color: colors.blue, backgroundColor: colors.blueSoft }]}>origine {ORIGINE_UI[o as MatriceOrigine] || o}: {mr.byOrigine[o]}</Text>
                ))}
              </View>
            </Card>
            <Card noPadding>
              {mr.perOp.slice(0, 80).map((o, idx, arr) => (
                <View key={o.infId} style={[styles.row, { borderBottomColor: colors.separator }, idx === arr.length - 1 && styles.last]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: colors.text }]}>{o.nome} · {o.matriceLabel}</Text>
                    <Text style={[styles.rowSub, { color: colors.text2 }]}>
                      origine {ORIGINE_UI[o.origine] || o.origine} · ciclo {o.cycleLen}gg · pos. {o.position + 1}
                      {o.deroghe ? ` · ${o.deroghe} deroghe (${o.motivi.join(', ')})` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.badge, { color: o.aderenzaPct >= 90 ? colors.green : colors.yellow, backgroundColor: o.aderenzaPct >= 90 ? colors.greenSoft : colors.yellowSoft }]}>{o.aderenzaPct}%</Text>
                </View>
              ))}
              {mr.perOp.length > 80 ? (
                <View style={[styles.row, styles.last]}>
                  <Text style={[styles.rowSub, { color: colors.text3 }]}>… e altri {mr.perOp.length - 80} operatori</Text>
                </View>
              ) : null}
            </Card>
          </>
        ) : null}

        {derogheRows.length ? (
          <>
            <SectionTitle>Deroghe Generate ({derogheRows.length})</SectionTitle>
            <Card noPadding>
              {derogheRows.slice(0, 80).map((r, idx, arr) => (
                <View key={idx} style={[styles.row, { borderBottomColor: colors.separator }, idx === arr.length - 1 && styles.last]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: colors.text }]}>{r.nome} · giorno {r.day}</Text>
                    <Text style={[styles.rowSub, { color: colors.text2 }]}>{r.rep} · {r.tipo} — {r.motivo}</Text>
                  </View>
                </View>
              ))}
              {derogheRows.length > 80 ? (
                <View style={[styles.row, styles.last]}>
                  <Text style={[styles.rowSub, { color: colors.text3 }]}>… e altre {derogheRows.length - 80} deroghe</Text>
                </View>
              ) : null}
            </Card>
          </>
        ) : null}

        {Object.keys(uncByRep).length ? (
          <>
            <SectionTitle>Turni scoperti per reparto</SectionTitle>
            <Card noPadding>
              {Object.keys(uncByRep).map((rid, idx, arr) => {
                const r = getRep(reparti, rid);
                if (!r) return null;
                return (
                  <View key={rid} style={[styles.row, { borderBottomColor: colors.separator }, idx === arr.length - 1 && styles.last]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: colors.text }]}>{r.nome}</Text>
                    </View>
                    <Text style={[styles.badge, { color: colors.red, backgroundColor: colors.redSoft }]}>{uncByRep[rid]} slot</Text>
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}

        <SectionTitle>Simulazione & Equità</SectionTitle>
        <Card>
          <View style={styles.simBtns}>
            <Button title="Simula 12 mesi" variant="soft" small onPress={() => runSim(12)} style={{ flex: 1 }} />
            <Button title="Simula 24 mesi" variant="secondary" small onPress={() => runSim(24)} style={{ flex: 1 }} />
          </View>
          {sim ? (
            <>
              <View style={styles.eqRow}>
                <Text style={[styles.eqLab, { color: colors.text2 }]}>Indice equità · {sim.label}</Text>
                <Text style={[styles.eqVal, { color: sim.equityIndex >= 80 ? colors.green : sim.equityIndex >= 60 ? colors.yellow : colors.red }]}>{sim.equityIndex}/100</Text>
              </View>
              <View style={styles.eqRow}>
                <Text style={[styles.eqLab, { color: colors.text2 }]}>Indice coerenza matrice</Text>
                <Text style={[styles.eqVal, { color: sim.coherenceIndex >= 80 ? colors.green : sim.coherenceIndex >= 60 ? colors.yellow : colors.red }]}>{sim.coherenceIndex}/100</Text>
              </View>
              <Text style={[styles.aggr, { color: colors.text2, marginTop: 4 }]}>Equilibrio {sim.livello} · σ ore {sim.stdDevOre} · più carico: {sim.penalized} · meno carico: {sim.favored}</Text>
              <View style={[styles.alert, { backgroundColor: colors.card2 }]}>
                <Text style={[styles.alertTxt, { color: colors.text2, fontWeight: '700' }]}>Analisi Equità</Text>
                <Text style={[styles.aggr, { color: colors.text2 }]}>Operatore più carico: {sim.penalized} · meno carico: {sim.favored}</Text>
                {([
                  ['ore', sim.diffOre, 24], ['notti', sim.diffNotti, 1], ['weekend', sim.diffWeekend, 1],
                  ['festivi', sim.diffFestivi, 1], ['riposi', sim.diffRiposi, 3], ['smonti', sim.diffSmonti, 2],
                ] as [string, number, number][]).map(([lab, val, thr]) => (
                  <Text key={lab} style={[styles.aggr, { color: val > thr ? colors.red : colors.text3 }]}>
                    {val > thr ? '⚠ ' : '• '}differenza {lab}: {val}{val > thr ? ` (oltre ±${thr})` : ''}
                  </Text>
                ))}
              </View>
              {sim.alerts.map((a, i) => (
                <View key={i} style={[styles.alert, { backgroundColor: a.severity === 'warn' ? colors.redSoft : colors.yellowSoft }]}>
                  <Text style={[styles.alertTxt, { color: a.severity === 'warn' ? colors.red : colors.yellow }]}>⚠ {a.message}</Text>
                </View>
              ))}
              <Text style={[styles.aggr, { color: colors.text2 }]}>
                Totali: {sim.aggregate.ore}h · {sim.aggregate.notti} notti · {sim.aggregate.weekend} weekend · {sim.aggregate.festivi} festivi · {sim.aggregate.straordinari} straord. · {sim.aggregate.riposi} riposi · {sim.aggregate.assenze} assenze
              </Text>
            </>
          ) : (
            <Text style={[styles.simHint, { color: colors.text3 }]}>Proiezione continua del ciclo (festività italiane incluse): ore, notti, weekend, festivi, straordinari, riposi, ferie ed equità per operatore.</Text>
          )}
        </Card>

        {sim ? (
          <>
            <SectionTitle>Qualità Operativa</SectionTitle>
            <Card>
              <View style={styles.eqRow}>
                <Text style={[styles.eqLab, { color: colors.text2 }]}>Indice di equità</Text>
                <Text style={[styles.eqVal, { color: sim.equityIndex >= 80 ? colors.green : sim.equityIndex >= 60 ? colors.yellow : colors.red }]}>{sim.equityIndex}/100</Text>
              </View>
              <View style={styles.eqRow}>
                <Text style={[styles.eqLab, { color: colors.text2 }]}>Indice di coerenza</Text>
                <Text style={[styles.eqVal, { color: sim.coherenceIndex >= 80 ? colors.green : sim.coherenceIndex >= 60 ? colors.yellow : colors.red }]}>{sim.coherenceIndex}/100</Text>
              </View>
              {([
                ['ore', sim.diffOre, 24], ['notti', sim.diffNotti, 1], ['weekend', sim.diffWeekend, 1],
                ['festivi', sim.diffFestivi, 1], ['riposi', sim.diffRiposi, 3], ['smonti', sim.diffSmonti, 2],
                ['reparti', sim.diffReparti, 2], ['settori', sim.diffSettori, 2],
              ] as [string, number, number][]).map(([lab, val, thr]) => (
                <View key={lab} style={styles.eqRow}>
                  <Text style={[styles.eqLab, { color: colors.text2 }]}>Differenza {lab}</Text>
                  <Text style={[styles.eqVal, { color: val > thr ? colors.red : colors.green }]}>{val}</Text>
                </View>
              ))}
              <Text style={[styles.aggr, { color: sim.alerts.length ? colors.red : colors.green, marginTop: 6 }]}>
                {sim.alerts.length ? 'Criticità rilevate: ' + sim.alerts.length : 'Nessuna criticità rilevata'}
              </Text>
              {sim.alerts.slice(0, 4).map((a, i) => (
                <Text key={i} style={[styles.aggr, { color: colors.text3 }]}>· {a}</Text>
              ))}
            </Card>

            <SectionTitle>Qualità Organizzativa</SectionTitle>
            <Card>
              <View style={styles.eqRow}>
                <Text style={[styles.eqLab, { color: colors.text2 }]}>Copertura</Text>
                <Text style={[styles.eqVal, { color: sim.coveragePct >= 95 ? colors.green : sim.coveragePct >= 85 ? colors.yellow : colors.red }]}>{sim.coveragePct}%</Text>
              </View>
              <View style={styles.eqRow}>
                <Text style={[styles.eqLab, { color: colors.text2 }]}>Equità</Text>
                <Text style={[styles.eqVal, { color: sim.equityIndex >= 80 ? colors.green : sim.equityIndex >= 60 ? colors.yellow : colors.red }]}>{sim.equityIndex}/100</Text>
              </View>
              <View style={styles.eqRow}>
                <Text style={[styles.eqLab, { color: colors.text2 }]}>Coerenza</Text>
                <Text style={[styles.eqVal, { color: sim.coherenceIndex >= 80 ? colors.green : sim.coherenceIndex >= 60 ? colors.yellow : colors.red }]}>{sim.coherenceIndex}/100</Text>
              </View>
              <View style={styles.eqRow}>
                <Text style={[styles.eqLab, { color: colors.text2 }]}>Preferenze soddisfatte</Text>
                <Text style={[styles.eqVal, { color: sim.prefPct >= 80 ? colors.green : sim.prefPct >= 60 ? colors.yellow : colors.red }]}>{sim.prefPct}%</Text>
              </View>
              <View style={styles.eqRow}>
                <Text style={[styles.eqLab, { color: colors.text2 }]}>Desiderata soddisfatti</Text>
                <Text style={[styles.eqVal, { color: sim.desPct >= 80 ? colors.green : sim.desPct >= 60 ? colors.yellow : colors.red }]}>{sim.desPct}%</Text>
              </View>
              <View style={styles.eqRow}>
                <Text style={[styles.eqLab, { color: colors.text2 }]}>Deroghe generate</Text>
                <Text style={[styles.eqVal, { color: colors.text }]}>{sim.deroghe}</Text>
              </View>
            </Card>
          </>
        ) : null}

        {sim ? (
          <Card noPadding>
            {sim.perOperator.map((o, idx) => (
              <View key={o.infId} style={[styles.row, { borderBottomColor: colors.separator }, idx === sim.perOperator.length - 1 && styles.last]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: colors.text }]}>{o.nome}</Text>
                  <Text style={[styles.rowSub, { color: colors.text2 }]}>{o.ore}h · {o.notti}N · {o.weekend}we · {o.festivi}fest · {o.straordinari}str · {o.smontiNotte} smonti{o.assenze ? ' · ' + o.assenze + 'ass' : ''}</Text>
                  <Text style={[styles.rowSub, { color: colors.text3 }]}>reparti: {o.repartoPiu || '—'}↑ {o.repartoMeno || '—'}↓ · settori: {o.distinctSettori || 0} ({o.settorePiu || '—'}↑)</Text>
                </View>
                <Text style={[styles.badge, { color: colors.blue, backgroundColor: colors.blueSoft }]}>{o.carico}%</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <SectionTitle>Monte ore contrattuale</SectionTitle>
        <Card>
          <View style={styles.simBtns}>
            <Button title="Mese corrente" variant="soft" small onPress={() => setAnnual(null)} style={{ flex: 1 }} />
            <Button title="Annuale (12 mesi)" variant="secondary" small onPress={() => runAnnual(12)} style={{ flex: 1 }} />
          </View>
          {(annual ? annual.alerts : mh.alerts).map((a, i) => (
            <View key={i} style={[styles.alert, { backgroundColor: a.level === 'warning' ? colors.redSoft : colors.blueSoft }]}>
              <Text style={[styles.alertTxt, { color: a.level === 'warning' ? colors.red : colors.blue }]}>{a.message}</Text>
            </View>
          ))}
          {annual ? (
            <Text style={[styles.aggr, { color: colors.text2, marginTop: 8 }]}>Periodo: {annual.label} · trend {annual.trend[0]?.label} → {annual.trend[annual.trend.length - 1]?.label}</Text>
          ) : null}
        </Card>

        <Card noPadding>
          {(annual ? annual.perOperator : mh.perOperator).map((o, idx, arr) => (
            <View key={o.infId} style={[styles.row, { borderBottomColor: colors.separator }, idx === arr.length - 1 && styles.last]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: colors.text }]}>{o.nome}</Text>
                <Text style={[styles.rowSub, { color: colors.text2 }]}>previste {o.expected}h · assegnate {o.assigned}h{o.overtime ? ' · straord. ' + o.overtime + 'h' : ''}{o.debt ? ' · debito ' + o.debt + 'h' : ''}</Text>
              </View>
              <Text style={[styles.badge, { color: o.diff > 0 ? colors.green : o.diff < 0 ? colors.red : colors.text2, backgroundColor: o.diff > 0 ? colors.greenSoft : o.diff < 0 ? colors.redSoft : colors.card2 }]}>{o.diff > 0 ? '+' : ''}{o.diff}h</Text>
            </View>
          ))}
        </Card>

        <Button
          title="Esporta Excel (XLSX)"
          variant="soft"
          full
          icon={<Icon name="grid-outline" size={18} color={colors.blue} />}
          onPress={doExportXLSX}
          style={{ marginTop: 6 }}
        />

        <Button
          title="Esporta PDF"
          variant="primary"
          full
          icon={<Icon name="document-text-outline" size={18} color="#fff" />}
          onPress={doExport}
          style={{ marginTop: 6 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 12, paddingBottom: 28 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  kpiCard: { width: '48.5%' },
  kpiVal: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  kpiLab: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  adhTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adhBig: { fontSize: 30, fontWeight: '800', minWidth: 76 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  mxChip: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  last: { borderBottomWidth: 0 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12.5, marginTop: 1 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, overflow: 'hidden' },
  simBtns: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  eqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  eqLab: { fontSize: 12.5, flex: 1, marginRight: 8 },
  eqVal: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  alert: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 8 },
  alertTxt: { fontSize: 12.5, fontWeight: '600' },
  aggr: { fontSize: 12, marginTop: 12, lineHeight: 18 },
  simHint: { fontSize: 12.5, marginTop: 10, lineHeight: 18 },
});
