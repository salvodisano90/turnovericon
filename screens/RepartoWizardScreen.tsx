// screens/RepartoWizardScreen.tsx

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { MATRICI, PRESETS, REPARTI_PREDEF, TURNI } from '../utils/constants';
import { cloneDeep, restMinutes, secCode, siglaForNome, uid } from '../utils/helpers';
import { OrariSet, Reparto, Turno } from '../types';
import SheetHeader from '../components/SheetHeader';
import StepsDots from '../components/StepsDots';
import Button from '../components/Button';
import SelectChip from '../components/SelectChip';
import OptionCard from '../components/OptionCard';
import Stepper from '../components/Stepper';

const TURNS: ('M' | 'P' | 'N')[] = ['M', 'P', 'N'];

export default function RepartoWizardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { addReparto, updateReparto, reparti, matriciCustom } = useStore();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = params.id ? reparti.find((r) => r.id === params.id) || null : null;

  const [step, setStep] = useState(1);
  const [nome, setNome] = useState(editing ? editing.nome : '');
  const [orari, setOrari] = useState<OrariSet>(() => cloneDeep(editing ? editing.orari : PRESETS.classico));
  const [matrice, setMatrice] = useState(editing ? editing.matrice : 'M62');
  const [settori, setSettori] = useState<{ M: number; P: number; N: number }>(editing ? { ...editing.settori } : { M: 2, P: 2, N: 1 });

  const sigla = siglaForNome(nome || '');

  const setTime = (t: 'M' | 'P' | 'N', field: 's' | 'e', value: string) => {
    setOrari((prev) => ({ ...prev, [t]: { ...prev[t], [field]: value } }));
  };
  const stepSettore = (t: 'M' | 'P' | 'N', d: number) => {
    setSettori((prev) => ({ ...prev, [t]: Math.min(Math.max(0, prev[t] + d), 6) }));
  };

  const save = () => {
    const finalNome = nome.trim();
    if (!finalNome) { toast.show('Inserisci un nome per il reparto', 'warning'); setStep(1); return; }
    const rep: Reparto = {
      id: editing ? editing.id : uid('rep'),
      nome: finalNome,
      sigla: siglaForNome(finalNome),
      orari: cloneDeep(orari),
      matrice,
      settori: { ...settori },
    };
    if (editing) {
      updateReparto(rep);
      toast.show(`Reparto ${finalNome} aggiornato. Piano ricalcolato.`, 'success');
    } else {
      addReparto(rep);
      toast.show(`Reparto ${finalNome} aggiunto. Piano ricalcolato.`, 'success');
    }
    router.back();
  };

  const pm = restMinutes('P', 'M', orari, orari);
  const nm = restMinutes('N', 'M', orari, orari);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, paddingBottom: insets.bottom }]}>
      <SheetHeader title={editing ? 'Modifica Reparto' : 'Nuovo Reparto'} subtitle={`Step ${step} di 4`} onClose={() => router.back()} />
      <StepsDots total={4} current={step} />
      <ScrollView contentContainerStyle={styles.body}>
        {step === 1 ? (
          <>
            <Text style={[styles.label, { color: colors.text }]}>Nome del reparto</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.line, backgroundColor: colors.bg }]}
              placeholder="Es. Cardiochirurgia"
              placeholderTextColor={colors.text3}
              value={nome}
              onChangeText={setNome}
            />
            <Text style={[styles.hint, { color: colors.text2 }]}>Reparti comuni (tocca per selezionare):</Text>
            <View style={styles.chips}>
              {REPARTI_PREDEF.map((r) => (
                <SelectChip key={r[1]} label={r[0]} selected={nome === r[0]} onPress={() => setNome(r[0])} />
              ))}
            </View>
            <View style={[styles.info, { backgroundColor: colors.blueSoft }]}>
              <Text style={[styles.infoTxt, { color: colors.blue }]}>Codice settori: {sigla} — es. M{sigla}1, P{sigla}2, N{sigla}1</Text>
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <View style={styles.chips}>
              <SelectChip label="Classico 6/14/22" onPress={() => setOrari(cloneDeep(PRESETS.classico))} />
              <SelectChip label="PS 7/13/19" onPress={() => setOrari(cloneDeep(PRESETS.ps))} />
              <SelectChip label="12h 7/19" onPress={() => setOrari(cloneDeep(PRESETS.h12))} />
            </View>
            {TURNS.map((t) => (
              <View key={t} style={styles.timeRow}>
                <Text style={[styles.timeLabel, { color: TURNI[t].col }]}>{TURNI[t].label}</Text>
                <TextInput
                  style={[styles.timeInput, { color: colors.text, borderColor: colors.line, backgroundColor: colors.bg }]}
                  value={orari[t].s}
                  onChangeText={(v) => setTime(t, 's', v)}
                  placeholder="07:00"
                  placeholderTextColor={colors.text3}
                  maxLength={5}
                />
                <TextInput
                  style={[styles.timeInput, { color: colors.text, borderColor: colors.line, backgroundColor: colors.bg }]}
                  value={orari[t].e}
                  onChangeText={(v) => setTime(t, 'e', v)}
                  placeholder="13:00"
                  placeholderTextColor={colors.text3}
                  maxLength={5}
                />
              </View>
            ))}
            <View style={[styles.restCheck, { backgroundColor: pm >= 660 ? colors.greenSoft : colors.redSoft }]}>
              <Text style={[styles.restTxt, { color: pm >= 660 ? colors.green : colors.red }]}>
                {pm >= 660 ? '✓' : '⚠'} Pomeriggio→Mattina: {orari.P.e}→{orari.M.s}{pm >= 660 ? ' (≥11h)' : ` — riposo <11h (${Math.floor(pm / 60)}h${pm % 60}m)`}
              </Text>
            </View>
            <View style={[styles.restCheck, { backgroundColor: nm >= 660 ? colors.greenSoft : colors.redSoft }]}>
              <Text style={[styles.restTxt, { color: nm >= 660 ? colors.green : colors.red }]}>
                {nm >= 660 ? '✓' : '⚠'} Notte→Mattina: {orari.N.e}→{orari.M.s}{nm >= 660 ? ' (≥11h)' : ` — riposo <11h (${Math.floor(nm / 60)}h${nm % 60}m)`}
              </Text>
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <OptionCard selected={matrice === ''} onPress={() => setMatrice('')}>
              <View style={styles.optRow}>
                <Text style={[styles.optTitle, { color: colors.text }]}>Eredita dal mese</Text>
                <Text style={[styles.optBadge, { color: colors.text2, backgroundColor: colors.card2 }]}>gerarchia</Text>
              </View>
              <Text style={[styles.infoTxt, { color: colors.text2 }]}>Nessuna matrice di reparto: gli operatori senza matrice usano quella mensile.</Text>
            </OptionCard>
            {[...MATRICI, ...matriciCustom].map((m) => {
              const badge = m.notti === 0 ? 'no notti' : `${m.notti}N/ciclo`;
              return (
                <OptionCard key={m.id} selected={matrice === m.id} onPress={() => setMatrice(m.id)}>
                  <View style={styles.optRow}>
                    <Text style={[styles.optTitle, { color: colors.text }]}>{m.label}</Text>
                    <Text style={[styles.optBadge, { color: colors.text2, backgroundColor: colors.card2 }]}>{badge}</Text>
                  </View>
                  <View style={styles.seq}>
                    {m.seq.map((tt, i) => (
                      <View key={i} style={[styles.seqBlk, { backgroundColor: colors.shift[tt as Turno].bg }]}>
                        <Text style={[styles.seqTxt, { color: colors.shift[tt as Turno].fg }]}>{tt}</Text>
                      </View>
                    ))}
                  </View>
                  {m.descrizione ? <Text style={[styles.infoTxt, { color: colors.text2, marginTop: 6 }]}>{m.descrizione}</Text> : null}
                </OptionCard>
              );
            })}
          </>
        ) : null}

        {step === 4 ? (
          <>
            {TURNS.map((t) => (
              <View key={t} style={styles.settRow}>
                <Text style={[styles.settLabel, { color: TURNI[t].col }]}>Slot {TURNI[t].label}</Text>
                <Stepper value={settori[t]} onChange={(d) => stepSettore(t, d)} />
              </View>
            ))}
            <View style={[styles.info, { backgroundColor: colors.blueSoft, marginTop: 6 }]}>
              <Text style={[styles.infoTxt, { color: colors.blue }]}>Codici settori generati:</Text>
            </View>
            <View style={styles.tags}>
              {TURNS.flatMap((t) => Array.from({ length: settori[t] }).map((_, i) => secCode(t, sigla, i + 1))).map((code) => (
                <Text key={code} style={[styles.tag, { color: colors.blue, backgroundColor: colors.blueSoft }]}>{code}</Text>
              ))}
              {TURNS.every((t) => settori[t] === 0) ? <Text style={{ color: colors.text3, fontSize: 12 }}>Nessun settore configurato</Text> : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.foot, { borderTopColor: colors.separator }]}>
        <Button title={step > 1 ? 'Indietro' : 'Annulla'} variant="ghost" onPress={() => (step > 1 ? setStep(step - 1) : router.back())} style={{ flex: 1 }} />
        <Button title={step < 4 ? 'Avanti' : 'Salva Reparto'} variant="primary" onPress={() => (step < 4 ? setStep(step + 1) : save())} style={{ flex: 1.4 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  hint: { fontSize: 12.5, marginTop: 14, marginBottom: 8 },
  input: { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  info: { borderRadius: 10, padding: 11, marginTop: 14 },
  infoTxt: { fontSize: 12.5, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  timeLabel: { width: 90, fontSize: 13, fontWeight: '600' },
  timeInput: { flex: 1, height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, textAlign: 'center' },
  restCheck: { borderRadius: 9, padding: 10, marginTop: 10 },
  restTxt: { fontSize: 12, fontWeight: '600' },
  optRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optTitle: { fontSize: 14, fontWeight: '700' },
  optBadge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  seq: { flexDirection: 'row', gap: 3, marginTop: 8 },
  seqBlk: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  seqTxt: { fontSize: 11, fontWeight: '700' },
  settRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  settLabel: { fontSize: 14, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, overflow: 'hidden' },
  foot: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
