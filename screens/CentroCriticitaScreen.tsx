// screens/CentroCriticitaScreen.tsx — Perché sono scoperto + Correzione automatica + Previsione

import React, { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import SheetHeader from '../components/SheetHeader';
import Card from '../components/Card';
import SectionTitle from '../components/SectionTitle';
import Button from '../components/Button';
import { whyUncovered, proposeAutoFix, forecastCoverage, AutoFixSolution } from '../services/engine';

export default function CentroCriticitaScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { ctx, currentPiano, applyFix } = useStore();
  const [hz, setHz] = useState(7);

  const why = useMemo(() => whyUncovered(ctx, currentPiano), [ctx, currentPiano]);
  const sols = useMemo(() => proposeAutoFix(ctx, currentPiano), [ctx, currentPiano]);
  const forecast = useMemo(() => forecastCoverage(ctx, currentPiano, hz, 1), [ctx, currentPiano, hz]);

  const covColor = (p: number) => (p >= 95 ? colors.green : p >= 85 ? colors.yellow : colors.red);
  const impColor = (v: string) => (v === 'nullo' || v === 'assente' ? colors.green : v === 'basso' || v === 'attenzione' ? colors.yellow : colors.red);
  const riskColor = (l: string) => (l === 'alto' ? colors.red : l === 'medio' ? colors.yellow : colors.green);

  const onApply = (sol: AutoFixSolution) => {
    applyFix(sol);
    toast.show(sol.azione.tipo === 'chiusura' ? 'Postazione chiusa' : 'Correzione applicata al piano', 'success');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Centro Criticità" subtitle="Perché sei scoperto, come correggere, cosa rischi" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>

        <SectionTitle>Perché oggi sono scoperto</SectionTitle>
        <Card>
          <View style={styles.rowBetween}>
            <Text style={[styles.big, { color: colors.text }]}>Giorno {why.day}</Text>
            <Text style={[styles.cov, { color: covColor(why.copertura) }]}>{why.copertura}%</Text>
          </View>
          {why.mancano.length ? <Text style={[styles.line, { color: colors.text2 }]}>Mancano: {why.mancano.join(', ')}</Text> : null}
          {why.postazioniScoperte.length ? <Text style={[styles.line, { color: colors.text2 }]}>Postazioni scoperte: {why.postazioniScoperte.join(', ')}</Text> : null}
          {why.cause.length ? (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.subhead, { color: colors.text3 }]}>Cause</Text>
              {why.cause.map((c, i) => <Text key={i} style={[styles.line, { color: colors.text2 }]}>• {c.nome} — {c.motivo}</Text>)}
            </View>
          ) : null}
          <View style={{ marginTop: 8 }}>
            <Text style={[styles.subhead, { color: colors.text3 }]}>Cause strutturali</Text>
            {why.causeStrutturali.map((c, i) => <Text key={i} style={[styles.line, { color: colors.text2 }]}>• {c}</Text>)}
          </View>
        </Card>

        <SectionTitle>Proponi correzione automatica</SectionTitle>
        {sols.length ? sols.map((sol, i) => (
          <Card key={i} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={[styles.solTitle, { color: colors.text }]}>{sol.titolo}</Text>
              <Text style={[styles.cov, { color: covColor(sol.coperturaDopo) }]}>{sol.coperturaPrima}% → {sol.coperturaDopo}%</Text>
            </View>
            <Text style={[styles.line, { color: colors.text2 }]}>{sol.descrizione}</Text>
            <View style={styles.badges}>
              <Badge label={`equità ${sol.impattoEquita}`} color={impColor(sol.impattoEquita)} bg={colors.card2} />
              <Badge label={`fatigue ${sol.impattoFatigue}`} color={impColor(sol.impattoFatigue)} bg={colors.card2} />
              <Badge label={`costo ${sol.impattoEconomico}`} color={impColor(sol.impattoEconomico)} bg={colors.card2} />
              <Badge label={`legale ${sol.rischioLegale}`} color={impColor(sol.rischioLegale)} bg={colors.card2} />
            </View>
            <Button title="Applica" small full icon="checkmark-outline" onPress={() => onApply(sol)} style={{ marginTop: 10 }} />
          </Card>
        )) : <Card><Text style={[styles.line, { color: colors.text3 }]}>Nessuna criticità da correggere: la copertura è adeguata.</Text></Card>}

        <SectionTitle>Cosa rischia di scoprirsi</SectionTitle>
        <View style={styles.hzRow}>
          {[{ l: '7 giorni', v: 7 }, { l: '14 giorni', v: 14 }, { l: 'Mese', v: 31 }].map((o) => {
            const on = hz === o.v;
            return <Pressable key={o.v} onPress={() => setHz(o.v)} style={[styles.hzChip, { backgroundColor: on ? colors.blueSoft : colors.card2, borderColor: on ? colors.blue : colors.separator }]}><Text style={[styles.hzTxt, { color: on ? colors.blue : colors.text2 }]}>{o.l}</Text></Pressable>;
          })}
        </View>
        {forecast.length ? <Card>{forecast.map((r, i) => (
          <View key={i} style={styles.fcRow}>
            <View style={[styles.dot, { backgroundColor: riskColor(r.livello) }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.fcDay, { color: colors.text }]}>Giorno {r.day} · {r.livello}</Text>
              <Text style={[styles.fcSub, { color: colors.text3 }]}>{(r.postazioniScoperte.join(', ') || `copertura ${r.copertura}%`)} — {r.motivi.join(', ')}</Text>
            </View>
          </View>
        ))}</Card> : <Card><Text style={[styles.line, { color: colors.text3 }]}>Nessun rischio rilevante nell'orizzonte selezionato.</Text></Card>}
      </ScrollView>
    </View>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <Text style={[styles.badge, { color, backgroundColor: bg }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  big: { fontSize: 16, fontWeight: '800' },
  cov: { fontSize: 16, fontWeight: '800' },
  line: { fontSize: 13.5, marginTop: 4, lineHeight: 18 },
  subhead: { fontSize: 12, fontWeight: '700', marginBottom: 2, textTransform: 'uppercase' },
  solTitle: { fontSize: 15, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden', textTransform: 'capitalize' },
  hzRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  hzChip: { paddingHorizontal: 14, height: 36, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hzTxt: { fontSize: 13, fontWeight: '700' },
  fcRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  fcDay: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  fcSub: { fontSize: 12, marginTop: 1 },
});
