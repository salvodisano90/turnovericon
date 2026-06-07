// screens/ReperibilitaScreen.tsx — Modulo reperibilità (P5): assegnazione, storico, richiamo, statistiche.
// Usa il modulo separato services/reperibilita.ts (non tocca il motore). Persistenza propria.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import SectionTitle from '../components/SectionTitle';
import PressableScale from '../components/PressableScale';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { RepAssignment } from '../types';
import { assignRep, loadRep, removeRep, repConflicts, repStats, saveRep, setRichiamo } from '../services/reperibilita';

export default function ReperibilitaScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { ctx, currentPiano, month, year } = useStore();
  const piano = currentPiano || {};

  const [list, setList] = useState<RepAssignment[]>([]);
  const [selOp, setSelOp] = useState<string | undefined>(undefined);
  const [day, setDay] = useState('');

  useEffect(() => { let m = true; loadRep().then((l) => { if (m) setList(l); }); return () => { m = false; }; }, []);
  const persist = (l: RepAssignment[]) => { setList(l); void saveRep(l); };

  const monthList = useMemo(() => list.filter((x) => x.month === month && x.year === year).sort((a, b) => a.day - b.day), [list, month, year]);
  const stats = useMemo(() => repStats(list, ctx.staff, month, year).filter((s) => s.reperibilita > 0), [list, ctx.staff, month, year]);
  const conflicts = useMemo(() => repConflicts(list, ctx, piano), [list, ctx, piano]);
  const nomeOf = (id: string) => (ctx.staff.find((s) => s.id === id)?.nome) || id;

  const add = () => {
    const d = parseInt(day, 10);
    if (!selOp) { toast.show('Seleziona un operatore', 'error'); return; }
    if (!d || d < 1 || d > 31) { toast.show('Giorno non valido (1–31)', 'error'); return; }
    persist(assignRep(list, { infId: selOp, day: d, month, year }));
    setDay(''); toast.show('Reperibilità assegnata', 'success');
  };

  if (!ctx.staff.length) {
    return (<View style={[styles.root, { backgroundColor: colors.bg }]}><SheetHeader title="Reperibilità" subtitle="Assegnazione e richiami" onClose={() => router.back()} /><EmptyState icon="call-outline" title="Nessun operatore" desc="Aggiungi il personale per assegnare la reperibilità." /></View>);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Reperibilità" subtitle="Assegnazione, richiami, statistiche" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {conflicts.length ? (
          <GlassCard style={{ marginBottom: 12, borderColor: colors.red }}>
            <Text style={[styles.warnTitle, { color: colors.red }]}>⚠ {conflicts.length} segnalazioni</Text>
            {conflicts.slice(0, 6).map((c, i) => <Text key={i} style={[styles.warn, { color: colors.text2 }]}>• {nomeOf(c.infId)}: {c.dettaglio}</Text>)}
          </GlassCard>
        ) : null}

        <SectionTitle>Assegna reperibilità</SectionTitle>
        <GlassCard>
          <Text style={[styles.lbl, { color: colors.text3 }]}>Operatore</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {ctx.staff.map((s) => { const on = selOp === s.id; return (
              <PressableScale key={s.id} onPress={() => setSelOp(s.id)}><View style={[styles.chip, { backgroundColor: on ? colors.blue : colors.card2, borderColor: on ? colors.blue : colors.separator }]}><Text style={{ color: on ? '#fff' : colors.text2, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{s.nome}</Text></View></PressableScale>
            ); })}
          </ScrollView>
          <View style={styles.addRow}>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.card2 }]} placeholder="Giorno (1–31)" placeholderTextColor={colors.text3} keyboardType="number-pad" value={day} onChangeText={setDay} />
            <Button title="Assegna" icon="add" onPress={add} />
          </View>
        </GlassCard>

        <SectionTitle>Storico mese ({monthList.length})</SectionTitle>
        {monthList.length ? monthList.map((a) => (
          <GlassCard key={a.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.nome, { color: colors.text }]}>{nomeOf(a.infId)} · giorno {a.day}</Text>
              <Text style={[styles.meta, { color: colors.text3 }]}>{a.richiamato ? `Richiamato${a.richiamoTurno ? ` (${a.richiamoTurno})` : ''}` : 'In reperibilità'}</Text>
            </View>
            <Text style={[styles.rich, { color: colors.text3 }]}>Richiamo</Text>
            <Switch value={!!a.richiamato} onValueChange={(v) => persist(setRichiamo(list, a.id, v))} />
            <PressableScale onPress={() => persist(removeRep(list, a.id))} hitSlop={6} style={[styles.del, { backgroundColor: colors.redSoft }]}><Icon name="trash" size={15} color={colors.red} /></PressableScale>
          </GlassCard>
        )) : <EmptyState icon="call-outline" title="Nessuna reperibilità" desc="Assegna la prima reperibilità del mese." />}

        {stats.length ? (
          <>
            <SectionTitle>Statistiche</SectionTitle>
            <GlassCard>
              {stats.map((s) => <View key={s.infId} style={styles.statRow}><Text style={[styles.statN, { color: colors.text }]}>{s.nome}</Text><Text style={[styles.statV, { color: colors.text2 }]}>{s.reperibilita} rep · {s.richiami} richiami</Text></View>)}
            </GlassCard>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  warnTitle: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  warn: { fontSize: 12.5, marginTop: 2 },
  lbl: { fontSize: 12, marginBottom: 6 },
  chip: { paddingHorizontal: 14, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 160 },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  input: { flex: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  nome: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12.5, marginTop: 2 },
  rich: { fontSize: 11 },
  del: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  statN: { fontSize: 14, fontWeight: '700' },
  statV: { fontSize: 13 },
});
