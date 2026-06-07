// screens/FerieWizardScreen.tsx

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { MONTHS, ASS_SOFT, ASS_COLOR, legacyAbsenceLabel } from '../utils/constants';
import { Ferie } from '../types';
import { daysInMonth } from '../utils/helpers';
import SheetHeader from '../components/SheetHeader';
import Button from '../components/Button';
import SelectChip from '../components/SelectChip';
import Stepper from '../components/Stepper';

export default function FerieWizardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ infId?: string; edit?: string; from?: string; to?: string; motivo?: string; tipo?: string; note?: string }>();
  const { staff, month, year, addFerie, updateFerie } = useStore();
  const dim = daysInMonth(year, month);

  const isEdit = params.edit === '1';
  const initFrom = params.from ? Math.max(1, Math.min(dim, parseInt(String(params.from), 10) || 1)) : 1;
  const initTo = params.to ? Math.max(1, Math.min(dim, parseInt(String(params.to), 10) || 1)) : 1;
  const initMotivo = params.motivo ? String(params.motivo) : (legacyAbsenceLabel(params.tipo) || (params.note ? String(params.note) : ''));

  const initial = params.infId ? String(params.infId) : staff.length ? staff[0].id : '';
  const [infId, setInfId] = useState(initial);
  const [from, setFrom] = useState(initFrom);
  const [to, setTo] = useState(initTo);
  const [motivo, setMotivo] = useState(initMotivo);

  const clampFrom = (d: number) => {
    const v = Math.min(Math.max(1, from + d), dim);
    setFrom(v);
    if (to < v) setTo(v);
  };
  const clampTo = (d: number) => {
    setTo(Math.min(Math.max(from, to + d), dim));
  };

  const inf = staff.find((s) => s.id === infId);
  const gg = to - from + 1;

  const onSave = () => {
    if (!infId) { toast.show('Aggiungi prima un membro dello staff', 'warning'); return; }
    const next: Ferie = { infId, from, to, month, year, motivo: motivo.trim() ? motivo.trim() : 'Assenza' };
    if (isEdit) {
      const orig: Ferie = { infId: String(params.infId || infId), from: initFrom, to: initTo, month, year, motivo: initMotivo };
      updateFerie(orig, next);
      toast.show('Assenza modificata. Piano aggiornato.', 'success');
    } else {
      addFerie(next);
      const lab = motivo.trim() || 'Assenza';
      toast.show(`${lab} di ${inf ? inf.nome : 'membro'} salvata. Piano aggiornato.`, 'success');
      const m = lab.toLowerCase();
      const urgente = m.includes('malatt') || m.includes('infortun') || m.includes('permess');
      if (urgente && inf && inf.reparti && inf.reparti.length) {
        router.replace({ pathname: '/sostituzioni', params: { day: String(from), repId: inf.reparti[0], excludeId: infId } });
        return;
      }
    }
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, paddingBottom: insets.bottom }]}>
      <SheetHeader title={isEdit ? 'Modifica Assenza' : 'Aggiungi Assenza'} subtitle={`${MONTHS[month]} ${year}`} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.label, { color: colors.text }]}>Membro dello staff</Text>
        <View style={styles.chips}>
          {staff.map((s) => (
            <SelectChip key={s.id} label={s.nome} selected={infId === s.id} onPress={() => setInfId(s.id)} />
          ))}
        </View>

        <View style={styles.dual}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.text }]}>Dal giorno</Text>
            <Stepper value={from} onChange={clampFrom} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.text }]}>Al giorno</Text>
            <Stepper value={to} onChange={clampTo} />
          </View>
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Motivazione</Text>
        <TextInput
          value={motivo}
          onChangeText={setMotivo}
          placeholder="Es. Ferie, Malattia, Legge 104, Permesso, Formazione…"
          placeholderTextColor={colors.text3}
          style={[styles.noteInput, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.line }]}
        />

        <View style={[styles.info, { backgroundColor: ASS_SOFT }]}>
          <Text style={[styles.infoTxt, { color: ASS_COLOR }]}>
            {inf ? inf.nome : ''} · ASS · {motivo.trim() || 'Assenza'} · {gg} giorni ({from}–{to} {MONTHS[month]} {year}){'\n'}Gli slot scoperti verranno coperti automaticamente.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.foot, { borderTopColor: colors.separator }]}>
        <Button title="Annulla" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button title="Conferma" variant="primary" onPress={onSave} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  dual: { flexDirection: 'row', gap: 18, marginBottom: 16 },
  info: { borderRadius: 11, padding: 12 },
  infoTxt: { fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  noteInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 16 },
  foot: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
