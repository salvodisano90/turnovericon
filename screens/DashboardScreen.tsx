// screens/DashboardScreen.tsx — Dashboard Coordinatore (concept premium). Solo presentazione: dati reali invariati.
import { AREA } from '../utils/designSystem';
import React, {useMemo, useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { fmtDataIt, daysInMonth } from '../utils/helpers';
import { fairnessReport } from '../services/fairness';
import { matrixFidelity } from '../services/matrixFidelity';
import { loadRepOp } from '../services/reperibilitaOp';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import Avatar from '../components/Avatar';
import PressableScale from '../components/PressableScale';
import CountUpText from '../components/CountUpText';
import FadeInView from '../components/FadeInView';
import GlassCard from '../components/GlassCard';
import KPICard from '../components/KPICard';
import QuickActionCard from '../components/QuickActionCard';
import NotificationBadge from '../components/NotificationBadge';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { dashboardData } from '../services/engine';
import { complianceReport } from '../services/compliance';

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export default function DashboardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { ctx, currentPiano, profile, year, month } = useStore();
  const { user } = useAuth();

  const today = new Date();
  const dayNum = today.getDate();
  const piano = currentPiano || {};
  const data = useMemo(() => dashboardData(ctx, piano, dayNum), [ctx, piano, dayNum]);
  const comp = useMemo(() => complianceReport(ctx, piano), [ctx, piano]);

  const hasData = ctx.staff.length > 0 || ctx.reparti.length > 0;
  const assenzeOggi = useMemo(() => ctx.staff.filter((st) => { const c = piano[st.id] && piano[st.id][dayNum]; return !!c && c.turno === 'F'; }).length, [ctx.staff, piano, dayNum]);
  const turniGenerati = useMemo(() => ctx.staff.reduce((a, st) => a + Object.keys(piano[st.id] || {}).length, 0), [ctx.staff, piano]);
  const fair = useMemo(() => { try { return hasData ? fairnessReport(ctx.staff, piano, year, month) : null; } catch { return null; } }, [ctx.staff, piano, year, month, hasData]);
  const dayPct = useMemo(() => {
    const n = daysInMonth(year, month); const tot = ctx.staff.length || 1; const out: number[] = [];
    for (let d = 1; d <= n; d++) {
      const inTurno = ctx.staff.filter((st) => { const c = piano[st.id] && piano[st.id][d]; return !!c && (c.turno === 'M' || c.turno === 'P' || c.turno === 'N'); }).length;
      out.push(inTurno / tot);
    }
    return out;
  }, [ctx.staff, piano, year, month]);
  const fairCol = fair ? (fair.fairnessScore >= 90 ? colors.green : fair.fairnessScore >= 75 ? colors.blue : fair.fairnessScore >= 60 ? colors.yellow : colors.red) : colors.text3;
  const mf = useMemo(() => { try { return hasData ? matrixFidelity(ctx, piano) : null; } catch { return null; } }, [ctx, piano, hasData]);
  const mfCol = mf ? (mf.score >= 90 ? colors.green : mf.score >= 75 ? colors.blue : mf.score >= 60 ? colors.yellow : colors.red) : colors.text3;
  const [reperibili, setReperibili] = useState<number | null>(null);
  useEffect(() => {
    let on = true;
    const iso = new Date().toISOString().slice(0, 10);
    loadRepOp().then((list) => { if (on) setReperibili((list || []).filter((r: any) => r.data === iso && r.stato !== 'rifiutata').length); }).catch(() => { if (on) setReperibili(null); });
    return () => { on = false; };
  }, []);
  const inService = useMemo(() => ctx.staff.filter((s) => { const c = piano[s.id] && piano[s.id][dayNum]; return !!c && (c.turno === 'M' || c.turno === 'P' || c.turno === 'N'); }).length, [ctx.staff, piano, dayNum]);
  const cov = data.coperturaOggi;
  const covLabel = cov >= 90 ? 'Ottima' : cov >= 70 ? 'Buona' : 'Critica';
  const covColor = cov >= 90 ? colors.green : cov >= 70 ? colors.yellow : colors.red;
  const crit = data.criticita.length;
  const covDelta = cov - data.coperturaMese;
  const covTrend = `${covDelta >= 0 ? '↑ +' : '↓ '}${covDelta}pp`;
  const insights: { icon: string; text: string; color: string }[] = [];
  insights.push(cov >= 90 ? { icon: 'checkmark', text: 'Copertura ottimale del reparto', color: colors.green } : { icon: 'alert-circle', text: `Copertura da migliorare (${cov}%)`, color: cov >= 70 ? colors.yellow : colors.red });
  if (data.ferieAttesa > 0) insights.push({ icon: 'mail-outline', text: `${data.ferieAttesa} richieste in attesa di approvazione`, color: colors.yellow });
  if (crit > 0) insights.push({ icon: 'alert-circle', text: `${crit} criticità rilevate nel piano del mese`, color: colors.red });
  if (data.ferieAttesa === 0 && crit === 0) insights.push({ icon: 'checkmark', text: 'Nessuna criticità rilevata oggi', color: colors.green });
  const score = (data.indiceSicurezza && data.indiceSicurezza.score) || 0;
  const scoreCol = score >= 90 ? '#34C759' : score >= 75 ? '#64D2FF' : score >= 60 ? '#FFD60A' : '#FF453A';
  const nome = user?.nome || (profile && (profile as any).nome) || 'Coordinatore';
  const greet = today.getHours() < 12 ? 'Buongiorno' : today.getHours() < 18 ? 'Buon pomeriggio' : 'Buonasera';

  const okR = (k: string) => (comp.perRegola[k] || 0) === 0;
  const checks: { label: string; ok: boolean }[] = [
    { label: 'Riposi 11h', ok: okR('riposo11h') },
    { label: 'Riposo settimanale', ok: okR('riposoSettimanale35h') },
    { label: 'Notti consecutive', ok: okR('nottiConsecutive') },
    { label: 'Giorni consecutivi', ok: okR('giorniConsecutivi') },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.topbar}>
          <View style={styles.brand}><Icon name="calendar" size={22} color={colors.blue} /><Text style={[styles.brandTxt, { color: colors.text }]}>TURNOVER</Text></View>
          <View style={styles.topRight}>
            <NotificationBadge count={data.ferieAttesa} onPress={() => router.push('/notifiche')} />
            <PressableScale onPress={() => router.push('/account-hub')}><Avatar nome={nome} ruolo="OWNER" size={48} config={profile as any} /></PressableScale>
          </View>
        </View>

        {/* Saluto */}
        <View style={styles.greetRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greet, { color: colors.text }]}>Ciao, {nome}</Text>
            <Text style={[styles.greetSub, { color: colors.text3 }]}>{greet}, ecco la situazione di oggi</Text>
          </View>
          <View style={[styles.datePill, { backgroundColor: colors.card2 }]}><Text style={[styles.dateTxt, { color: colors.text2 }]}>{GIORNI[today.getDay()]} {fmtDataIt(today)}</Text></View>
        </View>

        {!hasData ? (
          <View style={[styles.emptyWrap, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Icon name="analytics-outline" size={28} color={colors.text3} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nessun dato disponibile</Text>
            <Text style={[styles.emptySub, { color: colors.text3 }]}>Crea il primo reparto e aggiungi il personale: i KPI mostreranno solo dati reali.</Text>
          </View>
        ) : null}

        {hasData ? (<>
        {/* 1 — STATO GENERALE */}
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <Text style={[styles.heroKicker, { color: colors.text3 }]}>STATO DEL REPARTO</Text>
          <Text style={[styles.heroSub, { color: colors.text2 }]}>Situazione operativa aggiornata</Text>
          <View style={styles.heroBody}>
            <View style={[styles.ringBig, { borderColor: scoreCol }]}>
              <CountUpText value={score} style={[styles.ringBigVal, { color: colors.text }] as any} />
              <Text style={[styles.ringBigMax, { color: colors.text3 }]}>/100</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              {checks.map((c) => (
                <View key={c.label} style={styles.checkRow}>
                  <Icon name={c.ok ? 'checkmark' : 'alert-circle'} size={15} color={c.ok ? colors.green : colors.yellow} />
                  <Text style={[styles.checkTxt, { color: colors.text2 }]}>{c.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* 2 — KPI */}
        <View style={styles.kpiRow}>
          <KPICard icon="pulse" label="Copertura" value={`${cov}%`} sub={covLabel} subColor={covColor} trend={covTrend} trendColor={covDelta >= 0 ? colors.green : colors.red} />
          <KPICard icon="people" label="Operatori presenti" value={`${inService}/${ctx.staff.length}`} sub="In servizio" subColor={colors.green} />
        </View>
        <View style={styles.kpiRow}>
          <KPICard icon="sunny" label="Assenze" value={`${assenzeOggi}`} sub="Oggi" subColor={assenzeOggi ? colors.yellow : colors.green} />
          <KPICard icon="call-outline" label="Reperibili" value={reperibili === null ? '—' : `${reperibili}`} sub="Oggi" subColor={reperibili ? colors.blue : colors.text3} />
        </View>

        {/* 3 — CRITICITÀ */}
        {crit ? (<>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Criticità</Text>
          {data.criticita.slice(0, 3).map((c: any, i: number) => (
            <FadeInView key={i} delay={i * 60}>
            <PressableScale onPress={() => router.push('/centro-criticita')}>
              <View style={[styles.critRow, { backgroundColor: colors.card, borderColor: colors.line }]}>
                <View style={[styles.dotSm, { backgroundColor: colors.red }]} />
                <Text style={[styles.critTxt, { color: colors.text2 }]} numberOfLines={2}>{typeof c === 'string' ? c : ((c && (c.nome || c.titolo)) || 'Criticità')}</Text>
                <Icon name="chevron-forward" size={16} color={colors.text3} />
              </View>
            </PressableScale>
            </FadeInView>
          ))}
        </>) : null}

        {/* 3 — EQUITÀ (fairness + matrix fidelity) */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Equità</Text>
        <View style={styles.kpiRow}>
          <KPICard icon="scale-outline" label="Equità carichi" value={fair ? `${fair.fairnessScore}` : '—'} sub={fair ? fair.categoria : 'In attesa di dati'} subColor={fairCol} />
          <KPICard icon="grid-outline" label="Fedeltà matrice" value={mf ? `${mf.score}` : '—'} sub={mf ? mf.banda : 'In attesa di dati'} subColor={mfCol} />
        </View>

        {/* 4 — TREND (dati reali del piano) */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Trend del mese</Text>
        <FadeInView duration={500} dy={10}><View style={[styles.trendCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <View style={styles.spark}>
            {dayPct.map((pv, i) => (
              <View key={i} style={[styles.sparkBar, { height: 6 + Math.round(pv * 34), backgroundColor: colors.blue, opacity: 0.45 + pv * 0.55 }]} />
            ))}
          </View>
          <Text style={[styles.trendLbl, { color: colors.text3 }]}>Operatori in turno per giorno · mese corrente</Text>
        </View></FadeInView>

        {/* 5 — INSIGHT (una card, timeline) */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Cosa sta succedendo oggi?</Text>
        <FadeInView><View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
          {insights.slice(0, 4).map((ins, i) => (
            <View key={i} style={styles.tlRow}>
              <View style={styles.tlCol}>
                <View style={[styles.tlDot, { backgroundColor: ins.color }]} />
                {i < Math.min(insights.length, 4) - 1 ? <View style={[styles.tlLine, { backgroundColor: colors.separator }]} /> : null}
              </View>
              <Text style={[styles.insightTxt, { color: colors.text2, flex: 1 }]}>{ins.text}</Text>
            </View>
          ))}
        </View></FadeInView>
        </>) : null}

        {/* Azioni rapide */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Azioni rapide</Text>
        <View style={styles.kpiRow}>
          <QuickActionCard icon="sparkles-outline" title="Genera Turni" subtitle="Piano mensile automatico" onPress={() => router.push('/turni')} color={AREA.pianificazione} />
          <QuickActionCard icon="people-outline" title="Personale" subtitle="Anagrafica operatori" onPress={() => router.push('/personale')} color={AREA.personale} />
        </View>
        <View style={styles.kpiRow}>
          <QuickActionCard icon="alert-circle-outline" title="Centro Criticità" subtitle="Scoperture e problemi" badge={crit || undefined} onPress={() => router.push('/centro-criticita')} color={AREA.criticita} />
          <QuickActionCard icon="flask-outline" title="Assistente AI" subtitle="Analisi e suggerimenti" onPress={() => router.push('/assistente')} color={AREA.controllo} />
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  hero: { borderRadius: 32, borderWidth: 1, padding: 24, minHeight: 280, marginBottom: 16 },
  heroKicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  heroSub: { fontSize: 14, fontWeight: '500', marginTop: 2, marginBottom: 16 },
  heroBody: { flexDirection: 'row', alignItems: 'center' },
  ringBig: { width: 96, height: 96, borderRadius: 48, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  ringBigVal: { fontSize: 30, fontWeight: '800' },
  ringBigMax: { fontSize: 11, fontWeight: '700', marginTop: -2 },
  critRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
  dotSm: { width: 10, height: 10, borderRadius: 5 },
  critTxt: { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
  trendCard: { borderRadius: 24, borderWidth: 1, padding: 16, marginBottom: 4 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 44 },
  sparkBar: { flex: 1, borderRadius: 2 },
  trendLbl: { fontSize: 12, fontWeight: '600', marginTop: 10 },
  insightCard: { borderRadius: 28, borderWidth: 1, padding: 20 },
  tlRow: { flexDirection: 'row', gap: 12 },
  tlCol: { width: 12, alignItems: 'center' },
  tlDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  tlLine: { width: 2, flex: 1, marginVertical: 4 },
  emptyWrap: { borderRadius: 24, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8, marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  emptySub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
  root: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTxt: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greetRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 10 },
  greet: { fontSize: 26, fontWeight: '800' },
  greetSub: { fontSize: 14, marginTop: 3 },
  datePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  dateTxt: { fontSize: 12.5, fontWeight: '700' },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  analisiTop: { flexDirection: 'row', alignItems: 'center' },
  ring: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  ringVal: { fontSize: 26, fontWeight: '800' },
  ringMax: { fontSize: 11, marginTop: -2 },
  analisiTitle: { fontSize: 16, fontWeight: '800' },
  analisiSub: { fontSize: 12.5, marginTop: 2 },
  checks: { marginTop: 8, gap: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  checkTxt: { fontSize: 12.5, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: 18, marginBottom: 12 },
  insight: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10 },
  insightIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  insightTxt: { flex: 1, fontSize: 14, fontWeight: '600' },
});
