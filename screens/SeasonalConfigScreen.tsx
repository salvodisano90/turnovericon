// screens/SeasonalConfigScreen.tsx — configurazione matrici stagionali per reparto
// Per ciascuna stagione (primavera/estate/autunno/inverno) si sceglie una matrice
// (standard o personalizzata) e un intervallo di date personalizzabile (gg/mm).
// Salvando, il reparto assume matrice='STAGIONALE' e la configurazione seasonal.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Icon from '../components/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { MATRICI } from '../utils/constants';
import { validateSeasonalConfig } from '../services/matriceResolver';
import { Season, SeasonalConfig, SeasonRange, Turno, Matrice } from '../types';
import SheetHeader from '../components/SheetHeader';
import Card from '../components/Card';
import SectionTitle from '../components/SectionTitle';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';

const SEASONS: { key: Season; label: string; icon: string }[] = [
  { key: 'primavera', label: 'Primavera', icon: 'flower-outline' },
  { key: 'estate', label: 'Estate', icon: 'sunny-outline' },
  { key: 'autunno', label: 'Autunno', icon: 'leaf-outline' },
  { key: 'inverno', label: 'Inverno', icon: 'snow-outline' },
];

// Matrici cicliche standard proposte di default (le altre restano nel catalogo personalizzate).
const STD_CICLI = ['QUINTA', 'SESTA', 'OTTAVA', 'DECIMA', 'D12H'];

// Editor matrice personalizzata: M=Mattina P=Pomeriggio N=Notte SM(=S)=Smonto R=Riposo
const PALETTE: { code: Turno; label: string }[] = [
  { code: 'M', label: 'M' }, { code: 'P', label: 'P' }, { code: 'N', label: 'N' }, { code: 'S', label: 'SM' }, { code: 'R', label: 'R' },
];
const paletteLabel = (t: Turno) => (PALETTE.find((x) => x.code === t)?.label) || String(t);

const DEFAULT_CFG: SeasonalConfig = {
  primavera: { matrice: 'DECIMA', startMonth: 3, startDay: 1, endMonth: 5, endDay: 31 },
  estate: { matrice: 'QUINTA', startMonth: 6, startDay: 1, endMonth: 9, endDay: 30 },
  autunno: { matrice: 'OTTAVA', startMonth: 10, startDay: 1, endMonth: 11, endDay: 30 },
  inverno: { matrice: 'SESTA', startMonth: 12, startDay: 1, endMonth: 2, endDay: 28 },
};

const clampMonth = (n: number) => (n < 1 ? 12 : n > 12 ? 1 : n);
const clampDay = (n: number) => (n < 1 ? 31 : n > 31 ? 1 : n);
const pad = (n: number) => String(n).padStart(2, '0');

export default function SeasonalConfigScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { reparti, updateReparto, matriciCustom, addMatriceCustom } = useStore();

  const [repId, setRepId] = useState<string | null>(reparti.length ? reparti[0].id : null);
  const [cfg, setCfg] = useState<SeasonalConfig>(DEFAULT_CFG);
  const [editor, setEditor] = useState<{ season: Season | null; seq: Turno[] }>({ season: null, seq: [] });
  const addDay = (t: Turno) => setEditor((e) => ({ ...e, seq: [...e.seq, t] }));
  const removeDay = (i: number) => setEditor((e) => ({ ...e, seq: e.seq.filter((_, k) => k !== i) }));
  const moveDay = (i: number, d: number) => setEditor((e) => { const j = i + d; if (j < 0 || j >= e.seq.length) return e; const a = [...e.seq]; const tmp = a[i]; a[i] = a[j]; a[j] = tmp; return { ...e, seq: a }; });

  const rep = useMemo(() => reparti.find((r) => r.id === repId) || null, [reparti, repId]);

  // Quando cambia il reparto selezionato, ricarico la sua configurazione (o il default).
  useEffect(() => {
    if (rep && rep.seasonal) setCfg(rep.seasonal);
    else setCfg(DEFAULT_CFG);
  }, [repId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Elenco matrici selezionabili: cicli standard + tutte le personalizzate.
  const matOptions = useMemo(() => {
    const std = MATRICI.filter((m) => STD_CICLI.indexOf(m.id) >= 0).map((m) => ({ id: m.id, label: m.label, durata: m.durata || m.seq.length }));
    const cust = (matriciCustom || []).map((m) => ({ id: m.id, label: m.label, durata: m.durata || m.seq.length }));
    return [...std, ...cust];
  }, [matriciCustom]);

  const setRange = (s: Season, patch: Partial<SeasonRange>) => setCfg((c) => ({ ...c, [s]: { ...c[s], ...patch } }));
  const saveCustom = () => {
    if (!editor.season) return;
    if (editor.seq.length < 2) { toast.show('Aggiungi almeno 2 giorni alla sequenza', 'error'); return; }
    const id = 'CUSTOM_' + editor.season.toUpperCase().slice(0, 3) + '_' + Date.now().toString(36).toUpperCase();
    const label = 'Personalizzata · ' + (SEASONS.find((x) => x.key === editor.season)?.label || '');
    const m: Matrice = { id, label, seq: editor.seq, durata: editor.seq.length, notti: editor.seq.filter((c) => c === 'N').length };
    addMatriceCustom(m);
    setRange(editor.season, { matrice: id });
    setEditor({ season: null, seq: [] });
    toast.show('Matrice personalizzata salvata', 'success');
  };
  const setOp = (s: Season, patch: Record<string, any>) => setCfg((c) => ({ ...c, [s]: { ...c[s], op: { ...(c[s].op || {}), ...patch } } }));
  const setOpSet = (s: Season, t: 'M' | 'P' | 'N', delta: number) => setCfg((c) => {
    const op = c[s].op || {}; const settori = { ...(op.settori || {}) }; settori[t] = Math.max(0, (settori[t] != null ? settori[t] : 0) + delta);
    return { ...c, [s]: { ...c[s], op: { ...op, settori } } };
  });

  const salva = () => {
    if (!rep) { toast.show('Crea prima un reparto', 'error'); return; }
    // validazione minima: ogni stagione deve avere una matrice valida
    const missing = SEASONS.find((s) => !cfg[s.key] || !cfg[s.key].matrice);
    if (missing) { toast.show(`Seleziona una matrice per ${missing.label}`, 'error'); return; }
    updateReparto({ ...rep, matrice: 'STAGIONALE', seasonal: cfg });
    toast.show('Configurazione stagionale salvata', 'success');
    router.back();
  };

  const Stepper = ({ value, onDelta, suffix }: { value: number; onDelta: (d: number) => void; suffix?: string }) => (
    <View style={styles.stepper}>
      <Pressable hitSlop={8} onPress={() => onDelta(-1)} style={[styles.stepBtn, { backgroundColor: colors.card2, borderColor: colors.separator }]}>
        <Icon name="remove" size={16} color={colors.text} />
      </Pressable>
      <Text style={[styles.stepVal, { color: colors.text }]}>{pad(value)}{suffix || ''}</Text>
      <Pressable hitSlop={8} onPress={() => onDelta(1)} style={[styles.stepBtn, { backgroundColor: colors.card2, borderColor: colors.separator }]}>
        <Icon name="add" size={16} color={colors.text} />
      </Pressable>
    </View>
  );

  const allMatIds = useMemo(() => [...MATRICI, ...(matriciCustom || [])].map((m) => m.id), [matriciCustom]);
  const validation = useMemo(() => validateSeasonalConfig(cfg, allMatIds), [cfg, allMatIds]);
  const matLabel = (id?: string) => ([...MATRICI, ...(matriciCustom || [])].find((m) => m.id === id)?.label) || '— da assegnare';

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Matrici stagionali" subtitle="Assegna una matrice e un periodo a ogni stagione" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        {repId ? (
          <>
            <View style={[styles.valBanner, { backgroundColor: (validation.ok ? colors.green : colors.red) + '22', borderColor: validation.ok ? colors.green : colors.red }]}>
              <Icon name={validation.ok ? 'checkmark' : 'alert-circle'} size={18} color={validation.ok ? colors.green : colors.red} />
              <Text style={[styles.valTxt, { color: validation.ok ? colors.green : colors.red }]}>{validation.ok ? 'Configurazione valida' : validation.errors[0]}</Text>
            </View>
            <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.line }]}>
              {SEASONS.map((s) => (
                <View key={s.key} style={styles.sumRow}>
                  <Text style={[styles.sumSeason, { color: colors.text2 }]}>{s.label}</Text>
                  <Text style={[styles.sumMat, { color: colors.text }]} numberOfLines={1}>{matLabel(cfg[s.key] && cfg[s.key].matrice)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {!reparti.length ? (
          <EmptyState icon="business-outline" title="Nessun reparto" desc="Crea prima un reparto per configurare le stagioni." />
        ) : (
          <>
            <SectionTitle>Reparto</SectionTitle>
            <View style={styles.chipsRow}>
              {reparti.map((r) => {
                const on = r.id === repId;
                return (
                  <Pressable key={r.id} onPress={() => setRepId(r.id)} style={[styles.repChip, { backgroundColor: on ? colors.blueSoft : colors.card2, borderColor: on ? colors.blue : colors.separator }]}>
                    <Text style={[styles.repChipTxt, { color: on ? colors.blue : colors.text2 }]}>{r.nome}</Text>
                  </Pressable>
                );
              })}
            </View>

            {SEASONS.map((s) => {
              const rg = cfg[s.key] || DEFAULT_CFG[s.key];
              return (
                <View key={s.key} style={{ marginTop: 16 }}>
                  <View style={styles.seasonHead}>
                    <Icon name={s.icon as any} size={18} color={colors.text} />
                    <Text style={[styles.seasonTitle, { color: colors.text }]}>{s.label}</Text>
                  </View>
                  <Card>
                    <Text style={[styles.lbl, { color: colors.text2 }]}>Matrice</Text>
                    <View style={styles.matRow}>
                      {matOptions.map((m) => {
                        const on = rg.matrice === m.id;
                        return (
                          <Pressable key={m.id} onPress={() => setRange(s.key, { matrice: m.id })} style={[styles.matChip, { backgroundColor: on ? colors.blueSoft : colors.card2, borderColor: on ? colors.blue : colors.separator }]}>
                            <Text style={[styles.matChipTxt, { color: on ? colors.blue : colors.text2 }]}>{m.label}</Text>
                            <Text style={[styles.matChipSub, { color: colors.text3 }]}>ciclo {m.durata}</Text>
                          </Pressable>
                        );
                      })}
                      <Pressable onPress={() => setEditor(editor.season === s.key ? { season: null, seq: [] } : { season: s.key, seq: [] })} style={[styles.matChip, { backgroundColor: editor.season === s.key ? colors.blueSoft : colors.card2, borderColor: editor.season === s.key ? colors.blue : colors.separator }]}>
                        <Text style={[styles.matChipTxt, { color: editor.season === s.key ? colors.blue : colors.text2 }]}>+ Personalizzata</Text>
                        <Text style={[styles.matChipSub, { color: colors.text3 }]}>crea sequenza</Text>
                      </Pressable>
                    </View>

                    {editor.season === s.key ? (
                      <View style={[styles.editor, { borderColor: colors.separator }]}>
                        <Text style={[styles.lbl, { color: colors.text2 }]}>Sequenza personalizzata · {editor.seq.length} giorni</Text>
                        <View style={styles.seqWrap}>
                          {editor.seq.length ? editor.seq.map((t, i) => (
                            <View key={i} style={[styles.seqTag, { backgroundColor: colors.card2, borderColor: colors.separator }]}>
                              <Text style={[styles.seqTagTxt, { color: colors.text }]}>{paletteLabel(t)}</Text>
                              <Pressable hitSlop={6} onPress={() => moveDay(i, -1)}><Icon name="chevron-back" size={13} color={colors.text3} /></Pressable>
                              <Pressable hitSlop={6} onPress={() => moveDay(i, 1)}><Icon name="chevron-forward" size={13} color={colors.text3} /></Pressable>
                              <Pressable hitSlop={6} onPress={() => removeDay(i)}><Icon name="close" size={14} color={colors.red} /></Pressable>
                            </View>
                          )) : <Text style={[styles.matChipSub, { color: colors.text3 }]}>Nessun giorno: aggiungi dai pulsanti sotto.</Text>}
                        </View>
                        <View style={styles.palRow}>
                          {PALETTE.map((pp) => (
                            <Pressable key={pp.code} onPress={() => addDay(pp.code)} style={[styles.palBtn, { backgroundColor: colors.blueSoft, borderColor: colors.blue }]}>
                              <Text style={[styles.palTxt, { color: colors.blue }]}>{pp.label}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <Text style={[styles.matChipSub, { color: colors.text3, marginTop: 6 }]}>M=Mattina · P=Pomeriggio · N=Notte · SM=Smonto · R=Riposo</Text>
                        <View style={styles.editBtns}>
                          <Button title="Salva matrice" small icon="save-outline" onPress={saveCustom} />
                          <Button title="Annulla" small variant="ghost" onPress={() => setEditor({ season: null, seq: [] })} />
                          {editor.seq.length ? <Button title="Svuota" small variant="ghost" onPress={() => setEditor({ season: s.key, seq: [] })} /> : null}
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.dateBlock}>
                      <View style={styles.dateCol}>
                        <Text style={[styles.lbl, { color: colors.text2 }]}>Inizio (gg / mm)</Text>
                        <View style={styles.dateRow}>
                          <Stepper value={rg.startDay} onDelta={(d) => setRange(s.key, { startDay: clampDay(rg.startDay + d) })} />
                          <Text style={[styles.sep, { color: colors.text3 }]}>/</Text>
                          <Stepper value={rg.startMonth} onDelta={(d) => setRange(s.key, { startMonth: clampMonth(rg.startMonth + d) })} />
                        </View>
                      </View>
                      <View style={styles.dateCol}>
                        <Text style={[styles.lbl, { color: colors.text2 }]}>Fine (gg / mm)</Text>
                        <View style={styles.dateRow}>
                          <Stepper value={rg.endDay} onDelta={(d) => setRange(s.key, { endDay: clampDay(rg.endDay + d) })} />
                          <Text style={[styles.sep, { color: colors.text3 }]}>/</Text>
                          <Stepper value={rg.endMonth} onDelta={(d) => setRange(s.key, { endMonth: clampMonth(rg.endMonth + d) })} />
                        </View>
                      </View>
                    </View>
                    <View style={styles.opBlock}>
                      <Text style={[styles.opTitle, { color: colors.text2 }]}>Configurazione operativa</Text>
                      <View style={styles.opRow}>
                        {(['M', 'P', 'N'] as const).map((t) => (
                          <View key={t} style={styles.opCell}>
                            <Text style={[styles.opLbl, { color: colors.text3 }]}>Settori {t}</Text>
                            <Stepper value={(rg.op && rg.op.settori && rg.op.settori[t] != null) ? rg.op.settori[t]! : 0} onDelta={(d) => setOpSet(s.key, t, d)} />
                          </View>
                        ))}
                      </View>
                      <View style={[styles.opRow, { marginTop: 10 }]}>
                        <View style={styles.opCell}><Text style={[styles.opLbl, { color: colors.text3 }]}>Settori chiusi</Text><Stepper value={rg.op?.settoriChiusi || 0} onDelta={(d) => setOp(s.key, { settoriChiusi: Math.max(0, (rg.op?.settoriChiusi || 0) + d) })} /></View>
                        <View style={styles.opCell}><Text style={[styles.opLbl, { color: colors.text3 }]}>Posti letto</Text><Stepper value={rg.op?.postiLetto || 0} onDelta={(d) => setOp(s.key, { postiLetto: Math.max(0, (rg.op?.postiLetto || 0) + d) })} /></View>
                      </View>
                      <View style={[styles.opRow, { marginTop: 10 }]}>
                        <View style={styles.opCell}><Text style={[styles.opLbl, { color: colors.text3 }]}>Copertura min %</Text><Stepper value={rg.op?.coperturaMin || 0} onDelta={(d) => setOp(s.key, { coperturaMin: Math.max(0, Math.min(100, (rg.op?.coperturaMin || 0) + d * 5)) })} /></View>
                        <View style={styles.opCell}><Text style={[styles.opLbl, { color: colors.text3 }]}>Personale min</Text><Stepper value={rg.op?.personaleMin || 0} onDelta={(d) => setOp(s.key, { personaleMin: Math.max(0, (rg.op?.personaleMin || 0) + d) })} /></View>
                      </View>
                    </View>
                    <Text style={[styles.range, { color: colors.text3 }]}>{pad(rg.startDay)}/{pad(rg.startMonth)} → {pad(rg.endDay)}/{pad(rg.endMonth)} · {rg.matrice}</Text>
                  </Card>
                </View>
              );
            })}

            <View style={{ height: 20 }} />
            <Card style={{ backgroundColor: colors.card2 }}>
              <Text style={[styles.note, { color: colors.text2 }]}>
                Al cambio stagione il ciclo NON riparte dal primo giorno: il motore mantiene la continuità usando il calendario assoluto. Le preferenze forti (solo mattina/pomeriggio) e i combo restano prioritari.
              </Text>
            </Card>
            <View style={{ height: 14 }} />
            <Button title="Salva configurazione stagionale" onPress={salva} full icon="save-outline" />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  valBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  valTxt: { flex: 1, fontSize: 14, fontWeight: '800' },
  summary: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 16, gap: 8 },
  sumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sumSeason: { fontSize: 13.5, fontWeight: '700' },
  sumMat: { flex: 1, fontSize: 13.5, fontWeight: '700', textAlign: 'right' },
  root: { flex: 1 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  repChip: { paddingHorizontal: 14, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  repChipTxt: { fontSize: 14, fontWeight: '700' },
  seasonHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  seasonTitle: { fontSize: 16, fontWeight: '800' },
  lbl: { fontSize: 13, fontWeight: '600' },
  matRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  matChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, minWidth: 84 },
  matChipTxt: { fontSize: 13, fontWeight: '700' },
  matChipSub: { fontSize: 11, marginTop: 2 },
  editor: { marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12 },
  seqWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  seqTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  seqTagTxt: { fontSize: 14, fontWeight: '800', minWidth: 22, textAlign: 'center' },
  palRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  palBtn: { width: 48, height: 44, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  palTxt: { fontSize: 15, fontWeight: '800' },
  editBtns: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  dateBlock: { flexDirection: 'row', gap: 16, marginTop: 14 },
  dateCol: { flex: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 16, fontWeight: '800', minWidth: 30, textAlign: 'center' },
  sep: { fontSize: 16, fontWeight: '800', marginHorizontal: 2 },
  range: { fontSize: 12, marginTop: 12, fontWeight: '600' },
  opBlock: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#8884', paddingTop: 12 },
  opTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  opRow: { flexDirection: 'row', gap: 12 },
  opCell: { flex: 1 },
  opLbl: { fontSize: 12, marginBottom: 6 },
  note: { fontSize: 12.5, lineHeight: 18 },
});
