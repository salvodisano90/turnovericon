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
import { OrariSet, Reparto, Turno, SeasonalConfig, Season } from '../types';
import { TimeStepperField } from '../components/TimeStepper';
import SheetHeader from '../components/SheetHeader';
import StepsDots from '../components/StepsDots';
import Button from '../components/Button';
import SelectChip from '../components/SelectChip';
import OptionCard from '../components/OptionCard';
import PressableScale from '../components/PressableScale';
import SeasonalEditor from '../components/SeasonalEditor';
import { validateSeasonalConfig } from '../services/matriceResolver';
import Stepper from '../components/Stepper';

const TURNS: ('M' | 'P' | 'N')[] = ['M', 'P', 'N'];

export default function RepartoWizardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { addReparto, updateReparto, reparti, matriciCustom, addMatriceCustom, removeMatriceCustom } = useStore();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = params.id ? reparti.find((r) => r.id === params.id) || null : null;

  const [step, setStep] = useState(1);
  const [nome, setNome] = useState(editing ? editing.nome : '');
  const [orari, setOrari] = useState<OrariSet>(() => cloneDeep(editing ? editing.orari : PRESETS.classico));
  const [matrice, setMatrice] = useState(editing ? editing.matrice : 'M62');
  const DEF_SEASONAL: SeasonalConfig = {
    primavera: { startMonth: 3, startDay: 21, endMonth: 6, endDay: 20, matrice: '' },
    estate: { startMonth: 6, startDay: 21, endMonth: 9, endDay: 22, matrice: '' },
    autunno: { startMonth: 9, startDay: 23, endMonth: 12, endDay: 20, matrice: '' },
    inverno: { startMonth: 12, startDay: 21, endMonth: 3, endDay: 20, matrice: '' },
  };
  const [seasonal, setSeasonal] = useState<SeasonalConfig>(editing && editing.seasonal ? editing.seasonal : DEF_SEASONAL);
  const [matMode, setMatMode] = useState<'standard' | 'custom' | 'seasonal'>(editing ? (((editing as any).matriceMode as any) || (editing.matrice === 'STAGIONALE' ? 'seasonal' : 'standard')) : 'standard');
  const [settori, setSettori] = useState<{ M: number; P: number; N: number }>(editing ? { ...editing.settori } : { M: 2, P: 2, N: 1 });

  const sigla = siglaForNome(nome || '');

  const setTime = (t: 'M' | 'P' | 'N', field: 's' | 'e', value: string) => {
    setOrari((prev) => ({ ...prev, [t]: { ...prev[t], [field]: value } }));
  };
  const stepSettore = (t: 'M' | 'P' | 'N', d: number) => {
    setSettori((prev) => ({ ...prev, [t]: Math.min(Math.max(0, prev[t] + d), 6) }));
  };

  const allMat = [...MATRICI, ...matriciCustom];
  const matLabel = (id?: string) => (allMat.find((m) => m.id === id)?.label) || '—';
  const matSeqLen = (id?: string) => (allMat.find((m) => m.id === id)?.seq.length) || 0;
  const seasonalValid = validateSeasonalConfig(seasonal, allMat.map((m) => m.id)).ok;
  const SEASON_KEYS: { key: Season; label: string }[] = [{ key: 'primavera', label: 'Primavera' }, { key: 'estate', label: 'Estate' }, { key: 'autunno', label: 'Autunno' }, { key: 'inverno', label: 'Inverno' }];

  const save = () => {
    const finalNome = nome.trim();
    if (!finalNome) { toast.show('Inserisci un nome per il reparto', 'warning'); setStep(1); return; }
    if (matMode === 'seasonal' && !seasonalValid) { toast.show('Configurazione stagionale non valida: correggi le stagioni', 'warning'); setStep(3); return; }
    const rep: Reparto = {
      id: editing ? editing.id : uid('rep'),
      nome: finalNome,
      sigla: siglaForNome(finalNome),
      orari: cloneDeep(orari),
      matrice: matMode === 'seasonal' ? 'STAGIONALE' : matrice,
      matriceMode: matMode,
      seasonal: matMode === 'seasonal' ? seasonal : (editing ? editing.seasonal : undefined),
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
      <SheetHeader title={editing ? 'Modifica Reparto' : 'Nuovo Reparto'} subtitle={`Step ${step} di 4`} onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
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
              <View key={t} style={[styles.timeBlock, { backgroundColor: colors.card, borderColor: colors.line }]}>
                <Text style={[styles.timeLabel, { color: TURNI[t].col }]}>{TURNI[t].label}</Text>
                <View style={styles.timeFields}>
                  <TimeStepperField value={orari[t].s} onChange={(v) => setTime(t, 's', v)} />
                  <TimeStepperField value={orari[t].e} onChange={(v) => setTime(t, 'e', v)} />
                </View>
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
            <View style={styles.modeRow}>
              {(([['standard', 'Standard'], ['custom', 'Personalizzata'], ['seasonal', 'Stagionale']]) as Array<['standard' | 'custom' | 'seasonal', string]>).map(([mv, ml]) => (
                <PressableScale key={mv} onPress={() => setMatMode(mv)} style={{ flex: 1 }}>
                  <View style={[styles.modeBtn, { backgroundColor: matMode === mv ? colors.blueSoft : colors.card2, borderColor: matMode === mv ? colors.blue : colors.line }]}>
                    <Text style={[styles.modeTxt, { color: matMode === mv ? colors.blue : colors.text2 }]}>{ml}</Text>
                  </View>
                </PressableScale>
              ))}
            </View>

            {matMode === 'standard' ? (
              <>
                <OptionCard selected={matrice === ''} onPress={() => setMatrice('')}>
                  <View style={styles.optRow}>
                    <Text style={[styles.optTitle, { color: colors.text }]}>Eredita dal mese</Text>
                    <Text style={[styles.optBadge, { color: colors.text2, backgroundColor: colors.card2 }]}>gerarchia</Text>
                  </View>
                  <Text style={[styles.infoTxt, { color: colors.text2 }]}>Nessuna matrice di reparto: gli operatori senza matrice usano quella mensile.</Text>
                </OptionCard>
                {MATRICI.map((m) => (
                  <OptionCard key={m.id} selected={matrice === m.id} onPress={() => setMatrice(m.id)}>
                    <View style={styles.optRow}>
                      <Text style={[styles.optTitle, { color: colors.text }]}>{m.label}</Text>
                      <Text style={[styles.optBadge, { color: colors.text2, backgroundColor: colors.card2 }]}>{m.notti === 0 ? 'no notti' : `${m.notti}N/ciclo`}</Text>
                    </View>
                    <View style={styles.seq}>
                      {m.seq.map((tt, i) => (<View key={i} style={[styles.seqBlk, { backgroundColor: colors.shift[tt as Turno].bg }]}><Text style={[styles.seqTxt, { color: colors.shift[tt as Turno].fg }]}>{tt}</Text></View>))}
                    </View>
                    {m.descrizione ? <Text style={[styles.infoTxt, { color: colors.text2, marginTop: 6 }]}>{m.descrizione}</Text> : null}
                  </OptionCard>
                ))}
              </>
            ) : null}

            {matMode === 'custom' ? (
              <>
                <Button title="Crea nuova matrice" icon="add-circle-outline" full onPress={() => router.push('/matrice-editor')} style={{ marginBottom: 12 }} />
                {matriciCustom.length === 0 ? <Text style={[styles.infoTxt, { color: colors.text2 }]}>Nessuna matrice personalizzata: creane una.</Text> : null}
                {matriciCustom.map((m) => (
                  <OptionCard key={m.id} selected={matrice === m.id} onPress={() => setMatrice(m.id)}>
                    <View style={styles.optRow}>
                      <Text style={[styles.optTitle, { color: colors.text }]}>{m.label}</Text>
                      <Text style={[styles.optBadge, { color: colors.text2, backgroundColor: colors.card2 }]}>{m.seq.length}g</Text>
                    </View>
                    <View style={styles.seq}>
                      {m.seq.map((tt, i) => (<View key={i} style={[styles.seqBlk, { backgroundColor: colors.shift[tt as Turno].bg }]}><Text style={[styles.seqTxt, { color: colors.shift[tt as Turno].fg }]}>{tt}</Text></View>))}
                    </View>
                    <View style={styles.custActions}>
                      <PressableScale onPress={() => router.push({ pathname: '/matrice-editor', params: { id: m.id } })}><Text style={[styles.custAct, { color: colors.blue }]}>Modifica</Text></PressableScale>
                      <PressableScale onPress={() => addMatriceCustom({ ...m, id: `CUST_${Date.now()}`, label: `${m.label} Copia` })}><Text style={[styles.custAct, { color: colors.blue }]}>Duplica</Text></PressableScale>
                      <PressableScale onPress={() => { removeMatriceCustom(m.id); if (matrice === m.id) setMatrice(''); }}><Text style={[styles.custAct, { color: colors.red }]}>Elimina</Text></PressableScale>
                    </View>
                  </OptionCard>
                ))}
              </>
            ) : null}

            {matMode === 'seasonal' ? (
              <SeasonalEditor cfg={seasonal} onChange={setSeasonal} matrici={allMat.map((m) => ({ id: m.id, label: m.label }))} />
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
              <Text style={[styles.sumLbl, { color: colors.text3 }]}>REPARTO</Text>
              <Text style={[styles.sumVal, { color: colors.text }]}>{nome || '—'}</Text>
              <Text style={[styles.sumLbl, { color: colors.text3, marginTop: 10 }]}>MODALITÀ MATRICE</Text>
              <Text style={[styles.sumVal, { color: colors.text }]}>{matMode === 'standard' ? 'Standard' : matMode === 'custom' ? 'Personalizzata' : 'Stagionale'}</Text>
              {matMode !== 'seasonal' ? (
                <>
                  <Text style={[styles.sumLbl, { color: colors.text3, marginTop: 10 }]}>MATRICE</Text>
                  <Text style={[styles.sumVal, { color: colors.text }]}>{matrice ? matLabel(matrice) : 'Eredita dal mese'}</Text>
                  {matMode === 'custom' && matrice ? <Text style={[styles.infoTxt, { color: colors.text2 }]}>Durata ciclo: {matSeqLen(matrice)} giorni</Text> : null}
                </>
              ) : (
                <View style={{ marginTop: 8 }}>
                  {SEASON_KEYS.map((sk) => (
                    <View key={sk.key} style={styles.sumSeasonRow}>
                      <Text style={[styles.infoTxt, { color: colors.text3 }]}>{sk.label}</Text>
                      <Text style={[styles.infoTxt, { color: colors.text2, fontWeight: '700' }]}>{matLabel(seasonal[sk.key] && seasonal[sk.key].matrice)}</Text>
                    </View>
                  ))}
                  {!seasonalValid ? <Text style={[styles.infoTxt, { color: colors.red, marginTop: 6 }]}>⚠ Configurazione stagionale non valida — correggi nello step Matrice.</Text> : null}
                </View>
              )}
            </View>
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
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeBtn: { minHeight: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  modeTxt: { fontSize: 13.5, fontWeight: '800' },
  custActions: { flexDirection: 'row', gap: 16, marginTop: 12 },
  custAct: { fontSize: 13.5, fontWeight: '800' },
  infoCard: { borderRadius: 20, borderWidth: 1, padding: 18 },
  summaryCard: { borderRadius: 20, borderWidth: 1, padding: 18, marginBottom: 16 },
  sumLbl: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  sumVal: { fontSize: 17, fontWeight: '800', marginTop: 2 },
  sumSeasonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  timeBlock: { borderWidth: 1, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 12, marginBottom: 12 },
  timeFields: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  container: { flex: 1 },
  body: { padding: 16 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  hint: { fontSize: 12.5, marginTop: 14, marginBottom: 8 },
  input: { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  info: { borderRadius: 10, padding: 11, marginTop: 14 },
  infoTxt: { fontSize: 12.5, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  timeLabel: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
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
