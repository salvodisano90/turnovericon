// screens/SimulatoreScreen.tsx — Simulatore Scenario (what-if temporaneo, non tocca il piano reale)

import React, { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import SheetHeader from '../components/SheetHeader';
import Card from '../components/Card';
import SectionTitle from '../components/SectionTitle';
import Button from '../components/Button';
import { simulateScenario, ScenarioType, ScenarioResult } from '../services/engine';
import { TurnoLavoro } from '../types';

const TIPI: { k: ScenarioType; label: string }[] = [
  { k: 'ferie', label: 'Ferie' },
  { k: 'malattia', label: 'Malattia' },
  { k: 'assunzione', label: 'Assunzione' },
  { k: 'dimissione', label: 'Dimissione' },
  { k: 'chiusuraSettore', label: 'Chiudi settore' },
  { k: 'aperturaSettore', label: 'Apri settore' },
  { k: 'postiLettoUp', label: '+ Posti letto' },
  { k: 'postiLettoDown', label: '- Posti letto' },
];

export default function SimulatoreScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { ctx, currentPiano, staff, reparti } = useStore();

  const [tipo, setTipo] = useState<ScenarioType>('ferie');
  const [infId, setInfId] = useState<string | null>(staff[0]?.id || null);
  const [repId, setRepId] = useState<string | null>(reparti[0]?.id || null);
  const [turn, setTurn] = useState<TurnoLavoro>('M');
  const [from, setFrom] = useState(10);
  const [to, setTo] = useState(15);
  const [res, setRes] = useState<ScenarioResult | null>(null);

  const needsOp = tipo === 'ferie' || tipo === 'malattia' || tipo === 'dimissione';
  const needsRange = tipo === 'ferie' || tipo === 'malattia';
  const needsSector = tipo === 'chiusuraSettore' || tipo === 'aperturaSettore';

  const simula = () => {
    setRes(simulateScenario(ctx, currentPiano, { tipo, infId: infId || undefined, repId: repId || undefined, turn, dayFrom: from, dayTo: to, delta: 1 }));
  };

  const impCol = useMemo(() => {
    if (!res) return colors.text3;
    return res.impatto === 'basso' ? colors.green : res.impatto === 'medio' ? colors.yellow : colors.red;
  }, [res, colors]);

  const Stepper = ({ value, onDelta }: { value: number; onDelta: (d: number) => void }) => (
    <View style={styles.stepper}>
      <Pressable hitSlop={8} onPress={() => onDelta(-1)} style={[styles.stepBtn, { backgroundColor: colors.card2, borderColor: colors.separator }]}><Icon name="remove" size={16} color={colors.text} /></Pressable>
      <Text style={[styles.stepVal, { color: colors.text }]}>{value}</Text>
      <Pressable hitSlop={8} onPress={() => onDelta(1)} style={[styles.stepBtn, { backgroundColor: colors.card2, borderColor: colors.separator }]}><Icon name="add" size={16} color={colors.text} /></Pressable>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Simulatore Scenario" subtitle="Simulazioni temporanee: il piano reale non viene modificato" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>

        <SectionTitle>Tipo di scenario</SectionTitle>
        <View style={styles.chips}>
          {TIPI.map((t) => {
            const on = tipo === t.k;
            return (
              <Pressable key={t.k} onPress={() => { setTipo(t.k); setRes(null); }} style={[styles.chip, { backgroundColor: on ? colors.blueSoft : colors.card2, borderColor: on ? colors.blue : colors.separator }]}>
                <Text style={[styles.chipTxt, { color: on ? colors.blue : colors.text2 }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {needsOp ? (
          <>
            <SectionTitle>Operatore</SectionTitle>
            <View style={styles.chips}>
              {staff.map((p) => {
                const on = p.id === infId;
                return <Pressable key={p.id} onPress={() => setInfId(p.id)} style={[styles.chip, { backgroundColor: on ? colors.blueSoft : colors.card2, borderColor: on ? colors.blue : colors.separator }]}><Text style={[styles.chipTxt, { color: on ? colors.blue : colors.text2 }]}>{p.nome}</Text></Pressable>;
              })}
            </View>
          </>
        ) : null}

        {needsSector ? (
          <>
            <SectionTitle>Reparto e turno</SectionTitle>
            <View style={styles.chips}>
              {reparti.map((r) => { const on = r.id === repId; return <Pressable key={r.id} onPress={() => setRepId(r.id)} style={[styles.chip, { backgroundColor: on ? colors.blueSoft : colors.card2, borderColor: on ? colors.blue : colors.separator }]}><Text style={[styles.chipTxt, { color: on ? colors.blue : colors.text2 }]}>{r.nome}</Text></Pressable>; })}
            </View>
            <View style={[styles.chips, { marginTop: 8 }]}>
              {(['M', 'P', 'N'] as TurnoLavoro[]).map((t) => { const on = turn === t; return <Pressable key={t} onPress={() => setTurn(t)} style={[styles.chip, { backgroundColor: on ? colors.blueSoft : colors.card2, borderColor: on ? colors.blue : colors.separator }]}><Text style={[styles.chipTxt, { color: on ? colors.blue : colors.text2 }]}>{t}</Text></Pressable>; })}
            </View>
          </>
        ) : null}

        {needsRange ? (
          <>
            <SectionTitle>Periodo (giorni)</SectionTitle>
            <View style={styles.rangeRow}>
              <View style={styles.rangeCol}><Text style={[styles.lbl, { color: colors.text3 }]}>Dal</Text><Stepper value={from} onDelta={(d) => setFrom(Math.max(1, Math.min(31, from + d)))} /></View>
              <View style={styles.rangeCol}><Text style={[styles.lbl, { color: colors.text3 }]}>Al</Text><Stepper value={to} onDelta={(d) => setTo(Math.max(from, Math.min(31, to + d)))} /></View>
            </View>
          </>
        ) : null}

        <View style={{ height: 16 }} />
        <Button title="Simula scenario" full icon="play-outline" onPress={simula} />

        {res ? (
          <View style={{ marginTop: 18 }}>
            <SectionTitle>Risultato</SectionTitle>
            <Card>
              <View style={styles.resRow}><Text style={[styles.resLbl, { color: colors.text3 }]}>Copertura attuale</Text><Text style={[styles.resVal, { color: colors.text }]}>{res.coperturaAttuale}%</Text></View>
              <View style={styles.resRow}><Text style={[styles.resLbl, { color: colors.text3 }]}>Copertura prevista</Text><Text style={[styles.resVal, { color: impCol }]}>{res.coperturaPrevista}%</Text></View>
              <View style={styles.resRow}><Text style={[styles.resLbl, { color: colors.text3 }]}>Indice sicurezza</Text><Text style={[styles.resVal, { color: impCol }]}>{res.indiceSicurezzaPrima} → {res.indiceSicurezzaDopo}</Text></View>
              <View style={styles.resRow}><Text style={[styles.resLbl, { color: colors.text3 }]}>Giorni critici</Text><Text style={[styles.resVal, { color: colors.text }]}>{res.giorniCritici}</Text></View>
              <View style={styles.resRow}><Text style={[styles.resLbl, { color: colors.text3 }]}>Turni scoperti</Text><Text style={[styles.resVal, { color: colors.text }]}>{res.turniScoperti}</Text></View>
              <View style={styles.resRow}><Text style={[styles.resLbl, { color: colors.text3 }]}>Impatto</Text><Text style={[styles.resVal, { color: impCol, textTransform: 'capitalize' }]}>{res.impatto}</Text></View>
            </Card>
            {res.sostituti.length ? (
              <>
                <SectionTitle>Sostituti consigliati</SectionTitle>
                <Card>{res.sostituti.map((s, i) => <View key={s.infId} style={styles.resRow}><Text style={[styles.resLbl, { color: colors.text2 }]}>{i + 1}°</Text><Text style={[styles.resVal, { color: colors.text }]}>{s.nome}</Text></View>)}</Card>
              </>
            ) : null}
            {res.postazioniRecuperate.length ? (<><SectionTitle>Postazioni recuperate</SectionTitle><Card>{res.postazioniRecuperate.map((p, i) => <View key={i} style={styles.critRow}><Icon name="checkmark-circle-outline" size={15} color={colors.green} /><Text style={[styles.critTxt, { color: colors.text2 }]}>{p}</Text></View>)}</Card></>) : null}
            {res.postazioniPerse.length ? (<><SectionTitle>Postazioni perse</SectionTitle><Card>{res.postazioniPerse.map((p, i) => <View key={i} style={styles.critRow}><Icon name="close-circle-outline" size={15} color={colors.red} /><Text style={[styles.critTxt, { color: colors.text2 }]}>{p}</Text></View>)}</Card></>) : null}
            <SectionTitle>Vincoli</SectionTitle>
            <Card>{res.vincoli.map((v, i) => <View key={i} style={styles.critRow}><Icon name="shield-checkmark-outline" size={15} color={colors.text3} /><Text style={[styles.critTxt, { color: colors.text2 }]}>{v}</Text></View>)}</Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipTxt: { fontSize: 13, fontWeight: '700' },
  lbl: { fontSize: 12, marginBottom: 6 },
  rangeRow: { flexDirection: 'row', gap: 16 },
  rangeCol: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 18, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  resRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  resLbl: { fontSize: 13 },
  resVal: { fontSize: 14, fontWeight: '700' },
  critRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 5 },
  critTxt: { fontSize: 13, flex: 1 },
});
