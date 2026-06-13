// screens/DesiderataScreen.tsx — gestione desiderata operatori (elenco · crea · modifica · elimina)

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../components/Icon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { confirmAction } from '../utils/confirm';
import { Desiderata, DesiderataPriorita, DesiderataTipo } from '../types';
import SheetHeader from '../components/SheetHeader';
import Card from '../components/Card';
import SectionTitle from '../components/SectionTitle';
import Button from '../components/Button';
import SelectChip from '../components/SelectChip';
import EmptyState from '../components/EmptyState';

const TIPI: { id: DesiderataTipo; label: string }[] = [
  { id: 'lavoro', label: 'Lavorare' },
  { id: 'riposo', label: 'Riposo' },
  { id: 'mattina', label: 'Mattina' },
  { id: 'pomeriggio', label: 'Pomeriggio' },
  { id: 'evitaNotte', label: 'Evita notte' },
];
const TIPO_LABEL: Record<string, string> = {
  lavoro: 'Desidera lavorare', riposo: 'Desidera riposo', mattina: 'Preferirebbe mattina',
  pomeriggio: 'Preferirebbe pomeriggio', evitaNotte: 'Eviterebbe la notte',
};
const PRIORITA: DesiderataPriorita[] = ['bassa', 'media', 'alta'];
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function DesiderataScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { staff, desiderata, addDesiderata, updateDesiderata, removeDesiderata } = useStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [infId, setInfId] = useState<string>(staff[0]?.id || '');
  const [tipo, setTipo] = useState<DesiderataTipo>('riposo');
  const [priorita, setPriorita] = useState<DesiderataPriorita>('media');
  const [interval, setInterval] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const nameOf = (id: string) => staff.find((s) => s.id === id)?.nome || id;
  const sorted = useMemo(() => [...desiderata].sort((a, b) => a.dateStart.localeCompare(b.dateStart)), [desiderata]);

  const reset = () => {
    setEditingId(null); setInfId(staff[0]?.id || ''); setTipo('riposo'); setPriorita('media');
    setInterval(false); setDateStart(''); setDateEnd('');
  };

  const loadForEdit = (d: Desiderata) => {
    setEditingId(d.id || null); setInfId(d.infId); setTipo(d.tipo); setPriorita(d.priorita);
    setInterval(!!d.dateEnd && d.dateEnd !== d.dateStart); setDateStart(d.dateStart); setDateEnd(d.dateEnd || '');
  };

  const save = () => {
    if (!infId) { toast.show('Seleziona un operatore', 'warning'); return; }
    if (!ISO_RE.test(dateStart)) { toast.show('Data inizio non valida (AAAA-MM-GG)', 'warning'); return; }
    if (interval && !ISO_RE.test(dateEnd)) { toast.show('Data fine non valida (AAAA-MM-GG)', 'warning'); return; }
    if (interval && dateEnd < dateStart) { toast.show('La data fine precede l’inizio', 'warning'); return; }
    const d: Desiderata = { infId, tipo, priorita, dateStart, dateEnd: interval ? dateEnd : undefined };
    if (editingId) { updateDesiderata(editingId, d); toast.show('Desiderata aggiornato. Piano rigenerato.', 'success'); }
    else { addDesiderata(d); toast.show('Desiderata aggiunto. Piano rigenerato.', 'success'); }
    reset();
  };

  const del = (d: Desiderata) => {
    confirmAction('Eliminare il desiderata?', `${nameOf(d.infId)} · ${TIPO_LABEL[d.tipo]} · ${d.dateStart}`, () => {
      if (d.id) removeDesiderata(d.id);
      if (editingId === d.id) reset();
      toast.show('Desiderata eliminato', 'info');
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingBottom: insets.bottom }]}>
      <SheetHeader title="Desiderata" subtitle="Richieste personali del personale" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <SectionTitle>{editingId ? 'Modifica desiderata' : 'Nuovo desiderata'}</SectionTitle>
        <Card>
          {!staff.length ? (
            <Text style={[styles.hint, { color: colors.text3 }]}>Aggiungi prima del personale.</Text>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.text }]}>Operatore</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {staff.map((s) => (
                  <SelectChip key={s.id} label={s.nome} selected={infId === s.id} onPress={() => setInfId(s.id)} />
                ))}
              </ScrollView>

              <Text style={[styles.label, { color: colors.text, marginTop: 14 }]}>Tipologia</Text>
              <View style={styles.chips}>
                {TIPI.map((t) => (
                  <SelectChip key={t.id} label={t.label} selected={tipo === t.id} onPress={() => setTipo(t.id)} />
                ))}
              </View>

              <Text style={[styles.label, { color: colors.text, marginTop: 14 }]}>Priorità</Text>
              <View style={styles.chips}>
                {PRIORITA.map((p) => (
                  <SelectChip key={p} label={p[0].toUpperCase() + p.slice(1)} selected={priorita === p} onPress={() => setPriorita(p)} />
                ))}
              </View>

              <Text style={[styles.label, { color: colors.text, marginTop: 14 }]}>Periodo</Text>
              <View style={styles.chips}>
                <SelectChip label="Data singola" selected={!interval} onPress={() => setInterval(false)} />
                <SelectChip label="Intervallo" selected={interval} onPress={() => setInterval(true)} />
              </View>
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subLabel, { color: colors.text2 }]}>{interval ? 'Dal' : 'Data'}</Text>
                  <TextInput
                    value={dateStart} onChangeText={setDateStart} placeholder="AAAA-MM-GG" placeholderTextColor={colors.text3}
                    autoCapitalize="none" style={[styles.input, { color: colors.text, borderColor: colors.line, backgroundColor: colors.card }]}
                  />
                </View>
                {interval ? (
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subLabel, { color: colors.text2 }]}>Al</Text>
                    <TextInput
                      value={dateEnd} onChangeText={setDateEnd} placeholder="AAAA-MM-GG" placeholderTextColor={colors.text3}
                      autoCapitalize="none" style={[styles.input, { color: colors.text, borderColor: colors.line, backgroundColor: colors.card }]}
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.dual}>
                {editingId ? <Button title="Annulla modifica" variant="ghost" onPress={reset} style={{ flex: 1 }} /> : null}
                <Button title={editingId ? 'Salva modifiche' : 'Aggiungi desiderata'} variant="primary" onPress={save} style={{ flex: 1.4 }} />
              </View>
            </>
          )}
        </Card>

        <SectionTitle>Elenco desiderata ({sorted.length})</SectionTitle>
        {!sorted.length ? (
          <EmptyState icon="sparkles-outline" title="Nessun desiderata" desc="Aggiungi le richieste del personale: verranno rispettate dall’ottimizzatore secondo la priorità." />
        ) : (
          sorted.map((d) => (
            <Card key={d.id}>
              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: colors.text }]}>{nameOf(d.infId)}</Text>
                  <Text style={[styles.itemMeta, { color: colors.text2 }]}>
                    {TIPO_LABEL[d.tipo]} · {d.dateEnd && d.dateEnd !== d.dateStart ? `${d.dateStart} → ${d.dateEnd}` : d.dateStart}
                  </Text>
                  <Text style={[styles.prioTag, {
                    color: d.priorita === 'alta' ? colors.red : d.priorita === 'media' ? colors.yellow : colors.text3,
                  }]}>Priorità {d.priorita}</Text>
                </View>
                <Pressable hitSlop={8} style={styles.iconBtn} onPress={() => loadForEdit(d)}>
                  <Icon name="create-outline" size={20} color={colors.blue} />
                </Pressable>
                <Pressable hitSlop={8} style={styles.iconBtn} onPress={() => del(d)}>
                  <Icon name="trash-outline" size={20} color={colors.red} />
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  subLabel: { fontSize: 11, fontWeight: '600', marginBottom: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  dateRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  dual: { flexDirection: 'row', gap: 10, marginTop: 16 },
  hint: { fontSize: 12, lineHeight: 18 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { fontSize: 15, fontWeight: '700' },
  itemMeta: { fontSize: 12, marginTop: 2 },
  prioTag: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
