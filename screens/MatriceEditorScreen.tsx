// screens/MatriceEditorScreen.tsx — Editor matrice personalizzata (UI). Collega a addMatriceCustom/removeMatriceCustom (logica esistente).
// "Trascina per riordinare" → frecce su/giù (nessuna libreria drag installabile offline).
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import SheetHeader from '../components/SheetHeader';
import Button from '../components/Button';
import PressableScale from '../components/PressableScale';
import Icon from '../components/Icon';
import { Turno, Matrice } from '../types';
import { matriceBridge } from '../services/matriceBridge';

const TURNI: Turno[] = ['M', 'P', 'N', 'R', 'F'];
const LABEL: Record<string, string> = { M: 'Mattina', P: 'Pomeriggio', N: 'Notte', R: 'Riposo', F: 'Ferie' };

export default function MatriceEditorScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { matriciCustom, addMatriceCustom, removeMatriceCustom } = useStore();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = useMemo(() => (params.id ? matriciCustom.find((m) => m.id === params.id) : undefined), [params.id, matriciCustom]);

  const [nome, setNome] = useState(editing ? editing.label : '');
  const [descr, setDescr] = useState(editing ? (editing.descrizione || '') : '');
  const [seq, setSeq] = useState<Turno[]>(editing ? [...editing.seq] : ['M', 'M', 'P', 'P', 'N', 'N', 'R', 'R']);

  const turnoColor = (t: Turno) => t === 'M' ? colors.blue : t === 'P' ? colors.yellow : t === 'N' ? colors.purple : t === 'F' ? colors.green : colors.text3;

  const setDay = (i: number, t: Turno) => setSeq((s) => s.map((x, k) => (k === i ? t : x)));
  const delDay = (i: number) => setSeq((s) => s.filter((_, k) => k !== i));
  const move = (i: number, dir: -1 | 1) => setSeq((s) => { const j = i + dir; if (j < 0 || j >= s.length) return s; const c = [...s]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const addDay = () => setSeq((s) => [...s, 'M']);

  const save = () => {
    if (!nome.trim()) { toast.show('Inserisci il nome della matrice', 'warning'); return; }
    if (!seq.length) { toast.show('Aggiungi almeno un giorno', 'warning'); return; }
    const id = editing ? editing.id : `CUST_${Date.now()}`;
    const m: Matrice = { id, label: nome.trim(), seq: [...seq], notti: seq.filter((t) => t === 'N').length, descrizione: descr.trim() || undefined, durata: seq.length };
    if (editing) removeMatriceCustom(id);
    addMatriceCustom(m);
    matriceBridge.setCreated(id);
    toast.show(editing ? 'Matrice aggiornata' : 'Matrice creata', 'success');
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title={editing ? 'Modifica matrice' : 'Nuova matrice'} subtitle={`Ciclo di ${seq.length} giorni`} onClose={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lbl, { color: colors.text3 }]}>Nome matrice</Text>
        <TextInput value={nome} onChangeText={setNome} placeholder="Es. PS Estate" placeholderTextColor={colors.text3} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.line, color: colors.text }]} />
        <Text style={[styles.lbl, { color: colors.text3 }]}>Descrizione</Text>
        <TextInput value={descr} onChangeText={setDescr} placeholder="Breve descrizione del ciclo" placeholderTextColor={colors.text3} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.line, color: colors.text }]} />

        <Text style={[styles.section, { color: colors.text }]}>Pattern del ciclo</Text>
        {seq.map((t, i) => (
          <View key={i} style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Text style={[styles.dayNum, { color: colors.text3 }]}>Giorno {i + 1}</Text>
            <View style={styles.chips}>
              {TURNI.map((tt) => (
                <PressableScale key={tt} onPress={() => setDay(i, tt)}>
                  <View style={[styles.chip, { backgroundColor: t === tt ? turnoColor(tt) : colors.card2, borderColor: t === tt ? turnoColor(tt) : colors.line }]}>
                    <Text style={[styles.chipTxt, { color: t === tt ? '#000000' : colors.text2 }]}>{tt}</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
            <View style={styles.dayActions}>
              <PressableScale onPress={() => move(i, -1)} hitSlop={6}><View style={[styles.iconBtn, { backgroundColor: colors.card2 }]}><Icon name="chevron-back" size={18} color={colors.text2} /></View></PressableScale>
              <PressableScale onPress={() => move(i, 1)} hitSlop={6}><View style={[styles.iconBtn, { backgroundColor: colors.card2 }]}><Icon name="chevron-forward" size={18} color={colors.text2} /></View></PressableScale>
              <PressableScale onPress={() => delDay(i)} hitSlop={6}><View style={[styles.iconBtn, { backgroundColor: colors.redSoft }]}><Icon name="trash" size={17} color={colors.red} /></View></PressableScale>
            </View>
          </View>
        ))}
        <Button title="Aggiungi giorno" variant="secondary" icon="add-circle-outline" full onPress={addDay} style={{ marginTop: 6 }} />
        <Button title={editing ? 'Salva modifiche' : 'Salva matrice'} icon="save-outline" full onPress={save} style={{ marginTop: 10 }} />
        <Text style={[styles.note, { color: colors.text3 }]}>{LABEL.M} · {LABEL.P} · {LABEL.N} · {LABEL.R} · {LABEL.F}. Le frecce riordinano i giorni.</Text>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  lbl: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  section: { fontSize: 18, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  dayCard: { borderRadius: 20, borderWidth: 1, padding: 14, marginBottom: 10 },
  dayNum: { fontSize: 12.5, fontWeight: '700', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 48, minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  chipTxt: { fontSize: 16, fontWeight: '800' },
  dayActions: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'flex-end' },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 12, marginTop: 14, lineHeight: 17 },
});
