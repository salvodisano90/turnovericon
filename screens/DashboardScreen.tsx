// screens/DashboardScreen.tsx — Dashboard Coordinatore (dati reali del piano)
// Copertura, ferie, criticità, indicatori, distribuzione e suggerimenti AI proattivi.

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/Card';
import SectionTitle from '../components/SectionTitle';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import GlassCard from '../components/GlassCard';
import PressableScale from '../components/PressableScale';
import { DS } from '../utils/designSystem';
import { dashboardData, proactiveSuggestions, forecastCoverage } from '../services/engine';

export default function DashboardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { ctx, currentPiano, members, role, profile } = useStore();

  const today = new Date().getDate();
  const data = useMemo(() => dashboardData(ctx, currentPiano, today), [ctx, currentPiano, today]);
  const suggerimenti = useMemo(() => proactiveSuggestions(ctx, currentPiano), [ctx, currentPiano]);
  const forecast = useMemo(() => forecastCoverage(ctx, currentPiano, 14, today), [ctx, currentPiano, today]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const roleLabel = role === 'STAFF' ? 'Staff' : 'Coordinatore';
  const me = (members || []).find((m) => m.ruolo === 'OWNER') || (members || [])[0];
  const displayName = me && me.nome ? me.nome.split(' ')[0] : roleLabel;
  const avatarRole = me ? (me.ruolo === 'STAFF' ? 'Infermiere' : 'Coordinatore') : 'Coordinatore';

  const covColor = (p: number) => (p >= 95 ? colors.green : p >= 85 ? colors.yellow : colors.red);
  const critiche = data.postazioni.filter((p) => p.priorita === 'critica' && p.status !== 'verde').length;
  const rischiAlti = forecast.filter((f) => f.livello === 'alto').length;

  const KPIS = [
    { lbl: 'Copertura oggi', val: `${data.coperturaOggi}%`, color: covColor(data.coperturaOggi), icon: 'pulse-outline' },
    { lbl: 'Postazioni critiche', val: String(critiche), color: critiche ? colors.red : colors.green, icon: 'alert-circle-outline' },
    { lbl: 'Richieste in attesa', val: String(data.ferieAttesa), color: data.ferieAttesa ? colors.yellow : colors.text2, icon: 'mail-unread-outline' },
    { lbl: 'Criticità future', val: String(forecast.length), color: rischiAlti ? colors.red : forecast.length ? colors.yellow : colors.green, icon: 'trending-up-outline' },
  ];
  const QUICK = [
    { lbl: 'Genera Turni', icon: 'calendar-outline', to: '/' },
    { lbl: 'Personale', icon: 'people-outline', to: '/personale' },
    { lbl: 'Richieste', icon: 'mail-outline', to: '/richieste' },
    { lbl: 'Centro Criticità', icon: 'medkit-outline', to: '/centro-criticita' },
    { lbl: 'Assistente AI', icon: 'sparkles-outline', to: '/assistente' },
    { lbl: 'Postazioni', icon: 'grid-outline', to: '/postazioni' },
  ];

  const Bars = ({ rows }: { rows: { nome: string; val: number }[] }) => {
    const max = Math.max(1, ...rows.map((r) => r.val));
    return (
      <View>
        {rows.slice(0, 6).map((r, i) => (
          <View key={i} style={styles.barRow}>
            <Text style={[styles.barName, { color: colors.text2 }]} numberOfLines={1}>{r.nome}</Text>
            <View style={[styles.barTrack, { backgroundColor: colors.card2 }]}>
              <View style={[styles.barFill, { backgroundColor: colors.blue, width: `${Math.round((r.val / max) * 100)}%` }]} />
            </View>
            <Text style={[styles.barVal, { color: colors.text3 }]}>{r.val}</Text>
          </View>
        ))}
        {!rows.length ? <Text style={[styles.hint, { color: colors.text3 }]}>Nessun dato.</Text> : null}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headTopRow}>
          <PressableScale onPress={() => router.push('/notifiche')} hitSlop={8} style={[styles.closeBtn, { backgroundColor: colors.card2 }]}>
            <Icon name="notifications-outline" size={18} color={colors.text2} />
            {data.ferieAttesa > 0 ? <View style={[styles.bellBadge, { backgroundColor: colors.red, borderColor: colors.bg }]}><Text style={styles.bellBadgeTxt}>{data.ferieAttesa > 9 ? '9+' : data.ferieAttesa}</Text></View> : null}
          </PressableScale>
          <PressableScale onPress={() => router.back()} hitSlop={8} style={[styles.closeBtn, { backgroundColor: colors.card2 }]}>
            <Icon name="close" size={18} color={colors.text2} />
          </PressableScale>
        </View>
        <View style={styles.headMain}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.hello, { color: colors.text2 }]}>{greeting}</Text>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
          </View>
          <PressableScale onPress={() => router.push('/profilo')}>
            <Avatar nome={me && me.nome ? me.nome : roleLabel} ruolo={avatarRole} size={52} config={profile} />
          </PressableScale>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>

        <View style={styles.kpiGrid}>
          {KPIS.map((k) => (
            <GlassCard key={k.lbl} style={styles.kpiCard}>
              <Icon name={k.icon as any} size={18} color={k.color} />
              <Text style={[styles.kpiBig, { color: k.color }]}>{k.val}</Text>
              <Text style={[styles.kpiLbl, { color: colors.text2 }]}>{k.lbl}</Text>
            </GlassCard>
          ))}
        </View>

        <SectionTitle>Azioni rapide</SectionTitle>
        <View style={styles.qaGrid}>
          {QUICK.map((q) => (
            <PressableScale key={q.lbl} onPress={() => router.push(q.to as any)} style={styles.qaWrap}>
              <GlassCard style={styles.qaCard}>
                <View style={[styles.qaIcon, { backgroundColor: colors.blueSoft }]}><Icon name={q.icon as any} size={20} color={colors.blue} /></View>
                <Text style={[styles.qaTxt, { color: colors.text }]}>{q.lbl}</Text>
              </GlassCard>
            </PressableScale>
          ))}
        </View>


        {(() => {
          const si = data.indiceSicurezza; const c = si.livello === 'sicuro' ? colors.green : si.livello === 'attenzione' ? colors.yellow : colors.red;
          const cs = si.livello === 'sicuro' ? colors.greenSoft : si.livello === 'attenzione' ? colors.yellowSoft : colors.redSoft;
          const lab = si.livello === 'sicuro' ? '🟢 Sicuro' : si.livello === 'attenzione' ? '🟡 Attenzione' : '🔴 Critico';
          return (
            <View style={[styles.safety, { backgroundColor: cs, borderColor: c }]}>
              <View>
                <Text style={[styles.safetyLbl, { color: colors.text2 }]}>Indice di sicurezza assistenziale</Text>
                <Text style={[styles.safetyStatus, { color: c }]}>{lab}</Text>
              </View>
              <Text style={[styles.safetyScore, { color: c }]}>{si.score}</Text>
            </View>
          );
        })()}

        <SectionTitle>Copertura nel periodo</SectionTitle>
        <GlassCard style={styles.covRow}>
          <View style={styles.covCol}><Text style={[styles.covVal, { color: covColor(data.coperturaMese) }]}>{data.coperturaMese}%</Text><Text style={[styles.covLbl, { color: colors.text3 }]}>Mese</Text></View>
          <View style={[styles.covDiv, { backgroundColor: colors.separator }]} />
          <View style={styles.covCol}><Text style={[styles.covVal, { color: covColor(data.coperturaSettimana) }]}>{data.coperturaSettimana}%</Text><Text style={[styles.covLbl, { color: colors.text3 }]}>Settimana</Text></View>
        </GlassCard>

        <SectionTitle>Suggerimenti AI</SectionTitle>
        {suggerimenti.map((sg, i) => (
          <View key={i} style={[styles.sugg, { backgroundColor: colors.blueSoft, borderColor: colors.blue }]}>
            <Icon name="sparkles-outline" size={16} color={colors.blue} />
            <Text style={[styles.suggTxt, { color: colors.text }]}>{sg}</Text>
          </View>
        ))}

        {data.postazioni.length ? (
          <>
            <SectionTitle>Copertura Assistenziale Reale</SectionTitle>
            <Card>
              {data.postazioni.map((p) => {
                const dot = p.status === 'verde' ? colors.green : p.status === 'giallo' ? colors.yellow : colors.red;
                const label = p.status === 'verde' ? 'Coperta' : p.status === 'giallo' ? `Criticità (${p.giallo}gg)` : `Scoperta (${p.rosso}gg)`;
                return (
                  <View key={p.repId + p.postazioneId} style={styles.stRow}>
                    <View style={[styles.dot, { backgroundColor: dot }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stName, { color: colors.text }]}>{p.nome}</Text>
                      <Text style={[styles.stSub, { color: colors.text3 }]}>{p.repNome} · {p.priorita}</Text>
                    </View>
                    <Text style={[styles.stStatus, { color: dot }]}>{label}</Text>
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}

        <SectionTitle>Ferie</SectionTitle>
        <View style={styles.kpiRow}>
          {[{ l: 'In attesa', v: data.ferieAttesa, c: colors.yellow }, { l: 'Approvate', v: data.ferieApprovate, c: colors.green }, { l: 'Respinte', v: data.ferieRespinte, c: colors.red }].map((k) => (
            <View key={k.l} style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.separator }]}>
              <Text style={[styles.kpiVal, { color: k.c }]}>{k.v}</Text>
              <Text style={[styles.kpiLbl, { color: colors.text3 }]}>{k.l}</Text>
            </View>
          ))}
        </View>

        <SectionTitle>Criticità</SectionTitle>
        <Card>
          {data.criticita.map((c, i) => (
            <View key={i} style={styles.critRow}>
              <Icon name="warning-outline" size={16} color={colors.yellow} />
              <Text style={[styles.critTxt, { color: colors.text2 }]}>{c}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle>Indicatori</SectionTitle>
        <Card>
          {[['Più notti', data.indicatori.piuNotti], ['Più weekend', data.indicatori.piuWeekend], ['Più festivi', data.indicatori.piuFestivi], ['Più ore', data.indicatori.piuOre], ['Meno ore', data.indicatori.menoOre]].map(([l, v], i) => (
            <View key={i} style={styles.indRow}>
              <Text style={[styles.indLbl, { color: colors.text3 }]}>{l}</Text>
              <Text style={[styles.indVal, { color: colors.text }]}>{v || '—'}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle>Distribuzione notti</SectionTitle>
        <Card><Bars rows={data.distribuzione.notti} /></Card>
        <SectionTitle>Distribuzione weekend</SectionTitle>
        <Card><Bars rows={data.distribuzione.weekend} /></Card>
        <SectionTitle>Distribuzione festivi</SectionTitle>
        <Card><Bars rows={data.distribuzione.festivi} /></Card>

        <View style={{ height: 16 }} />
        {forecast.length ? (
          <>
            <SectionTitle>Criticità future (14 giorni)</SectionTitle>
            <Card>
              {forecast.slice(0, 8).map((r, i) => {
                const rc = r.livello === 'alto' ? colors.red : r.livello === 'medio' ? colors.yellow : colors.green;
                return (
                  <View key={i} style={styles.stRow}>
                    <View style={[styles.dot, { backgroundColor: rc }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stName, { color: colors.text }]}>Giorno {r.day} · {r.livello}</Text>
                      <Text style={[styles.stSub, { color: colors.text3 }]}>{(r.postazioniScoperte.join(', ') || `copertura ${r.copertura}%`)} — {r.motivi.join(', ')}</Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}

        <View style={{ height: 16 }} />
        <Button title="Apri Centro Criticità" full icon="medkit-outline" onPress={() => router.push('/centro-criticita')} />
        <View style={{ height: 10 }} />
        <Button title="Apri Simulatore Scenario" variant="secondary" full icon="flask-outline" onPress={() => router.push('/simulatore')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: DS.space.xl, paddingBottom: 6 },
  headTopRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, minHeight: 30 },
  bellBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bellBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headMain: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 8 },
  hello: { fontSize: 15, fontWeight: '600' },
  name: { fontSize: 32, fontWeight: '800', letterSpacing: 0.2 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: { width: '47.5%', flexGrow: 1, minHeight: 118, justifyContent: 'space-between' },
  kpiBig: { fontSize: 30, fontWeight: '900', marginTop: 8 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  qaWrap: { width: '47.5%', flexGrow: 1 },
  qaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  qaIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qaTxt: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  covRow: { flexDirection: 'row', alignItems: 'center' },
  covCol: { flex: 1, alignItems: 'center' },
  covDiv: { width: StyleSheet.hairlineWidth, height: 34 },
  covVal: { fontSize: 22, fontWeight: '800' },
  covLbl: { fontSize: 12, marginTop: 2 },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  safety: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  safetyLbl: { fontSize: 12.5, fontWeight: '600' },
  safetyStatus: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  safetyScore: { fontSize: 40, fontWeight: '900' },
  kpi: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  kpiVal: { fontSize: 24, fontWeight: '800' },
  kpiLbl: { fontSize: 12, marginTop: 2 },
  sugg: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  suggTxt: { fontSize: 13.5, flex: 1, lineHeight: 18 },
  critRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 5 },
  critTxt: { fontSize: 13.5, flex: 1 },
  indRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  indLbl: { fontSize: 13 },
  indVal: { fontSize: 14, fontWeight: '700' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  barName: { width: 64, fontSize: 12 },
  barTrack: { flex: 1, height: 14, borderRadius: 7, overflow: 'hidden' },
  barFill: { height: 14, borderRadius: 7 },
  barVal: { width: 24, fontSize: 12, textAlign: 'right' },
  hint: { fontSize: 13 },
  stRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  stName: { fontSize: 14, fontWeight: '700' },
  stSub: { fontSize: 11.5, marginTop: 1, textTransform: 'capitalize' },
  stStatus: { fontSize: 12.5, fontWeight: '700' },
});
