// screens/DashboardScreen.tsx — Dashboard Coordinatore (concept premium). Solo presentazione: dati reali invariati.
import { AREA } from '../utils/designSystem';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { fmtDataIt } from '../utils/helpers';
import { fairnessReport } from '../services/fairness';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import Avatar from '../components/Avatar';
import PressableScale from '../components/PressableScale';
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
  const fairCol = fair ? (fair.fairnessScore >= 90 ? colors.green : fair.fairnessScore >= 75 ? colors.blue : fair.fairnessScore >= 60 ? colors.yellow : colors.red) : colors.text3;
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
        {/* SEZIONE 1 — Stato reparto */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Stato reparto</Text>
        <View style={styles.kpiRow}>
          <KPICard icon="pulse" label="Copertura oggi" value={`${cov}%`} sub={covLabel} subColor={covColor} trend={covTrend} trendColor={covDelta >= 0 ? colors.green : colors.red} />
          <KPICard icon="people" label="Operatori in servizio" value={`${inService}/${ctx.staff.length}`} sub="Presenti" subColor={colors.green} />
        </View>
        <View style={styles.kpiRow}>
          <KPICard icon="sunny" label="Assenze oggi" value={`${assenzeOggi}`} sub="Ferie / permessi" subColor={assenzeOggi ? colors.yellow : colors.green} />
          <KPICard icon="grid-outline" label="Turni generati" value={`${turniGenerati}`} sub="Celle assegnate" subColor={turniGenerati ? colors.blue : colors.text3} />
        </View>

        {/* SEZIONE 2 — Rischi */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Rischi</Text>
        <View style={styles.kpiRow}>
          <KPICard icon="alert-circle" label="Criticità aperte" value={`${crit}`} sub="Da risolvere" subColor={crit ? colors.red : colors.green} onPress={() => router.push('/centro-criticita')} />
          <KPICard icon="mail-outline" label="Richieste in attesa" value={`${data.ferieAttesa}`} sub="Da approvare" subColor={data.ferieAttesa ? colors.yellow : colors.green} onPress={() => router.push('/richieste')} />
        </View>
        {fair ? (
          <View style={styles.kpiRow}>
            <KPICard icon="scale-outline" label="Equità carichi" value={`${fair.fairnessScore}`} sub={fair.categoria} subColor={fairCol} />
          </View>
        ) : null}

        {/* Analisi piano del mese */}
        <GlassCard style={{ marginTop: 14 }}>
          <View style={styles.analisiTop}>
            <View style={[styles.ring, { borderColor: colors.blue }]}>
              <Text style={[styles.ringVal, { color: colors.text }]}>{score}</Text>
              <Text style={[styles.ringMax, { color: colors.text3 }]}>/100</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={[styles.analisiTitle, { color: colors.text }]}>Analisi piano del mese</Text>
              <Text style={[styles.analisiSub, { color: colors.text3 }]}>Indice di sicurezza assistenziale</Text>
              <View style={styles.checks}>
                {checks.map((c) => (
                  <View key={c.label} style={styles.checkRow}>
                    <Icon name={c.ok ? 'checkmark' : 'alert-circle'} size={15} color={c.ok ? colors.green : colors.yellow} />
                    <Text style={[styles.checkTxt, { color: colors.text2 }]}>{c.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <Button title="Apri analisi completa" full icon="stats-chart-outline" onPress={() => router.push('/centro-criticita')} style={{ marginTop: 14 }} />
        </GlassCard>

        {/* Insight AI */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Cosa sta succedendo oggi?</Text>
        {insights.map((ins, i) => (
          <View key={i} style={[styles.insight, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <View style={[styles.insightIcon, { backgroundColor: ins.color + '22' }]}><Icon name={ins.icon} size={18} color={ins.color} /></View>
            <Text style={[styles.insightTxt, { color: colors.text2 }]}>{ins.text}</Text>
          </View>
        ))}
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
