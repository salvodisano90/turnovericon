// screens/StaffDetailScreen.tsx

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '../utils/confirm';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { countTurno, countWork, getCell, getEmptyCell, monteTurni } from '../services/engine';
import { MONTHS, TURNI, getAssenza, legacyAbsenceLabel } from '../utils/constants';
import { daysInMonth, getCtr, getInf, getMx, jsDow, staffIndex } from '../utils/helpers';
import { Turno } from '../types';
import SheetHeader from '../components/SheetHeader';
import Avatar from '../components/Avatar';
import Button from '../components/Button';

export default function StaffDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ infId: string }>();
  const infId = String(params.infId);

  const { staff, reparti, ferie, currentPiano, year, month, removeStaff, removeFerie } = useStore();
  const inf = getInf(staff, infId);

  if (!inf) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <SheetHeader title="Dettaglio" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        <Text style={{ color: colors.text2, padding: 16 }}>Operatore non trovato.</Text>
      </View>
    );
  }

  const ctr = getCtr(inf.contratto);
  const mx = getMx(inf.matrice);
  const dim = daysInMonth(year, month);
  const work = countWork(currentPiano, infId, dim);
  const mt = monteTurni(inf);
  const nN = countTurno(currentPiano, infId, 'N', dim);
  const pct = mt ? Math.min(100, Math.round((work / mt) * 100)) : 0;
  const over = work > mt;

  const myFerie = ferie.filter((f) => f.infId === infId && f.month === month && f.year === year);
  const first = jsDow(year, month, 1);

  const confirmRemove = () => {
    confirmAction('Rimuovere membro', `Rimuovere ${inf.nome} dallo staff?`, () => {
      removeStaff(infId);
      toast.show(`${inf.nome} rimosso`, 'success');
      router.back();
    }, 'Rimuovi');
  };

  const tag = (label: string, soft = false) => (
    <Text key={label} style={[styles.tag, { color: soft ? colors.text2 : colors.blue, backgroundColor: soft ? colors.card2 : colors.blueSoft }]}>{label}</Text>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.card, paddingBottom: insets.bottom }]}>
      <SheetHeader
        title={inf.nome}
        subtitle={inf.qualifica}
        onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        left={<Avatar name={inf.nome} index={staffIndex(staff, infId)} size={44} />}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.tags}>
          {tag(ctr.label)}
          {tag(mx ? mx.label : '–', true)}
          {tag(`${inf.nottiPerCiclo}N/ciclo`, true)}
        </View>

        <Text style={[styles.label, { color: colors.text2 }]}>CARICO TURNI</Text>
        <View style={styles.usage}>
          <View style={[styles.bar, { backgroundColor: colors.line }]}>
            <View style={[styles.fill, { width: `${pct}%`, backgroundColor: over ? colors.red : colors.blue }]} />
          </View>
          <Text style={[styles.usageTxt, { color: colors.text }]}>{work}/{mt}</Text>
        </View>
        <Text style={[styles.note, { color: colors.text3 }]}>Notti: {nN}/{ctr.nottiMax}{over ? ' · ⚠ straordinario' : ''}</Text>

        <Text style={[styles.label, { color: colors.text2 }]}>REPARTI</Text>
        <View style={styles.tags}>
          {(inf.reparti || []).length ? (inf.reparti || []).map((rid) => {
            const r = reparti.find((x) => x.id === rid);
            return r ? tag(r.nome) : null;
          }) : <Text style={[styles.empty, { color: colors.text3 }]}>Nessun reparto assegnato</Text>}
        </View>

        {((inf.esenzioniTurni || []).length || (inf.esenzioniSettori || []).length) ? (
          <>
            <Text style={[styles.label, { color: colors.text2 }]}>ESENZIONI</Text>
            <View style={styles.tags}>
              {(inf.esenzioniTurni || []).map((t) => (
                <Text key={'t' + t} style={[styles.tag, { color: colors.red, backgroundColor: colors.redSoft }]}>No {TURNI[t].label}</Text>
              ))}
              {(inf.esenzioniSettori || []).map((c) => (
                <Text key={'s' + c} style={[styles.tag, { color: colors.red, backgroundColor: colors.redSoft }]}>No {c}</Text>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.label, { color: colors.text2 }]}>ASSENZE</Text>
        {myFerie.length ? myFerie.map((f, i) => (
          <View key={i} style={styles.ferieRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.ferieTxt, { color: colors.text }]}>ASS · {(f.motivo && f.motivo.trim()) ? f.motivo.trim() : (legacyAbsenceLabel(f.tipo) || 'Assenza')} · {f.from}–{f.to} {MONTHS[month]}</Text>
            </View>
            <Pressable
              hitSlop={6}
              onPress={() => router.push({ pathname: '/ferie-wizard', params: { infId, edit: '1', from: String(f.from), to: String(f.to), motivo: (f.motivo && f.motivo.trim()) ? f.motivo.trim() : (legacyAbsenceLabel(f.tipo) || 'Assenza') } })}
            >
              <Text style={[styles.ferieEdit, { color: colors.blue }]}>Modifica</Text>
            </Pressable>
            <Pressable hitSlop={6} onPress={() => { removeFerie(f); toast.show('Assenza rimossa', 'success'); }}>
              <Text style={[styles.ferieDel, { color: colors.red }]}>Rimuovi</Text>
            </Pressable>
          </View>
        )) : <Text style={[styles.empty, { color: colors.text3 }]}>Nessuna assenza pianificata</Text>}

        <Text style={[styles.label, { color: colors.text2 }]}>{MONTHS[month].toUpperCase()} {year}</Text>
        <View style={styles.cal}>
          {['D', 'L', 'M', 'M', 'G', 'V', 'S'].map((d, i) => (
            <Text key={i} style={[styles.calDow, { color: colors.text3 }]}>{d}</Text>
          ))}
          {Array.from({ length: first }).map((_, i) => <View key={'b' + i} style={styles.calDay} />)}
          {Array.from({ length: dim }).map((_, i) => {
            const d = i + 1;
            const c = getCell(currentPiano, infId, d) || getEmptyCell();
            const ca = c.turno === 'F' ? getAssenza() : undefined;
            const sc = colors.shift[c.turno as Turno];
            const cbg = ca ? ca.soft : sc.bg;
            const cfg = ca ? ca.color : sc.fg;
            return (
              <View key={d} style={[styles.calDay, { backgroundColor: cbg }]}>
                <Text style={[styles.calLetter, { color: cfg }]}>{ca ? ca.code : c.turno}</Text>
                <Text style={[styles.calNum, { color: cfg }]}>{d}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.foot, { borderTopColor: colors.separator }]}>
        <Button
          title="Assenza"
          variant="soft"
          icon={<Icon name="calendar-outline" size={18} color={colors.blue} />}
          onPress={() => router.push({ pathname: '/ferie-wizard', params: { infId } })}
          style={{ flex: 1 }}
        />
        <Button
          title="Modifica"
          variant="secondary"
          icon={<Icon name="create-outline" size={18} color={colors.text} />}
          onPress={() => router.push({ pathname: '/staff-wizard', params: { id: infId } })}
          style={{ flex: 1 }}
        />
        <Button
          title="Rimuovi"
          variant="danger"
          icon={<Icon name="trash-outline" size={18} color={colors.red} />}
          onPress={confirmRemove}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, marginTop: 14, marginBottom: 8 },
  usage: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1, height: 8, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  usageTxt: { fontSize: 13, fontWeight: '700' },
  note: { fontSize: 12, marginTop: 6 },
  empty: { fontSize: 12 },
  ferieRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6 },
  ferieTxt: { fontSize: 13.5 },
  ferieNote: { fontSize: 11.5, marginTop: 1 },
  ferieEdit: { fontSize: 13, fontWeight: '700' },
  ferieDel: { fontSize: 13, fontWeight: '700' },
  cal: { flexDirection: 'row', flexWrap: 'wrap' },
  calDow: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 9, fontWeight: '700', marginBottom: 4 },
  calDay: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, marginBottom: 2 },
  calLetter: { fontSize: 11, fontWeight: '800' },
  calNum: { fontSize: 8, opacity: 0.7 },
});
