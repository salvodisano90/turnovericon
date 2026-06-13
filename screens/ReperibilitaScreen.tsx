// screens/ReperibilitaScreen.tsx — Modulo reperibilità (P5): assegnazione, storico, richiamo, statistiche.
// Usa il modulo separato services/reperibilita.ts (non tocca il motore). Persistenza propria.
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
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
import { RepAssignment, ReperibilitaOperatore } from '../types';
import { assignRep, loadRep, removeRep, repConflicts, repStats, saveRep, setRichiamo } from '../services/reperibilita';
import { loadRepOp, saveRepOp, aggiungiRichiestaRep, setStatoRep, badgeColorRep } from '../services/reperibilitaOp';
import { fmtDataIt } from '../utils/helpers';
import { can } from '../utils/permissions';

export default function ReperibilitaScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { ctx, currentPiano, month, year, role, members, currentEmail } = useStore();
  const piano = currentPiano || {};

  // --- Disponibilità operatore (overlay separato) ---
  const [repOp, setRepOp] = useState<ReperibilitaOperatore[]>([]);
  useEffect(() => { let m = true; loadRepOp().then((l) => { if (m) setRepOp(l); }); return () => { m = false; }; }, []);
  const meRep = (members || []).find((mm) => (mm.email || '').toLowerCase() === (currentEmail || '').toLowerCase());
  const myStaffId = (meRep && meRep.infId) || '';
  const myRepOp = repOp.filter((r) => r.staffId === myStaffId);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const today = new Date();
  const [rgg, setRgg] = useState(today.getDate());
  const [rmm, setRmm] = useState(today.getMonth() + 1);
  const [raaaa, setRaaaa] = useState(today.getFullYear());
  const [tuttoGiorno, setTuttoGiorno] = useState(true);
  const [fasciaTxt, setFasciaTxt] = useState('');
  const [tel, setTel] = useState('');
  const [noteTxt, setNoteTxt] = useState('');
  useEffect(() => { const last = myRepOp.length ? myRepOp[0].telefono : ''; if (last && !tel) setTel(last); }, [myRepOp.length]);
  const fmtIso = (iso: string) => { const q = (iso || '').split('-'); return q.length === 3 ? fmtDataIt(new Date(+q[0], +q[1] - 1, +q[2])) : iso; };
  const statoLabel = (st: string) => (st === 'approvata' ? 'APPROVATA' : st === 'rifiutata' ? 'RIFIUTATA' : 'IN ATTESA');
  const nomeStaff = (id: string) => (ctx.staff.find((x) => x.id === id)?.nome) || ((members || []).find((m) => m.infId === id)?.nome) || id;
  const submitRepOp = () => {
    if (!tel.trim()) { toast.show('Inserisci il numero di telefono', 'warning'); return; }
    if (!myStaffId) { toast.show('Operatore non collegato a questo accesso', 'warning'); return; }
    const iso = `${raaaa}-${pad2(rmm)}-${pad2(rgg)}`;
    const next = aggiungiRichiestaRep(repOp, { staffId: myStaffId, data: iso, fascia: tuttoGiorno ? '' : fasciaTxt.trim(), telefono: tel.trim(), note: noteTxt.trim() || undefined });
    setRepOp(next); saveRepOp(next); setNoteTxt(''); toast.show('Disponibilità inviata (in attesa)', 'success');
  };
  const setStatoOp = (id: string, stato: 'approvata' | 'rifiutata') => { if (!can(role, 'approve')) return; const next = setStatoRep(repOp, id, stato); setRepOp(next); saveRepOp(next); };
  const chiama = (telnum: string) => { const n = (telnum || '').replace(/[^0-9+]/g, ''); if (n) Linking.openURL(`tel:${n}`); };
  const renderRepCard = (r: ReperibilitaOperatore) => {
    const bc = badgeColorRep(r.stato, colors);
    return (
      <View key={r.id} style={[styles.opCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.opData, { color: colors.text }]}>{nomeStaff(r.staffId)}</Text>
          <Text style={[styles.opNote, { color: colors.text3 }]}>{fmtIso(r.data)} · {r.fascia || 'Tutto il giorno'} · {r.telefono}</Text>
          {r.note ? <Text style={[styles.opNote, { color: colors.text3 }]}>{r.note}</Text> : null}
          <View style={[styles.badge, { alignSelf: 'flex-start', marginTop: 6, backgroundColor: bc + '22', borderColor: bc }]}><Text style={[styles.badgeTxt, { color: bc }]}>{statoLabel(r.stato)}</Text></View>
        </View>
        <View style={styles.opActions}>
          <PressableScale onPress={() => chiama(r.telefono)}><View style={[styles.actBtn, { backgroundColor: colors.blueSoft }]}><Text style={[styles.actTxt, { color: colors.blue }]}>Chiama</Text></View></PressableScale>
          {can(role, 'approve') && r.stato !== 'approvata' ? <PressableScale onPress={() => setStatoOp(r.id, 'approvata')}><View style={[styles.actBtn, { backgroundColor: colors.green + '22' }]}><Text style={[styles.actTxt, { color: colors.green }]}>Accetta</Text></View></PressableScale> : null}
          {can(role, 'approve') && r.stato !== 'rifiutata' ? <PressableScale onPress={() => setStatoOp(r.id, 'rifiutata')}><View style={[styles.actBtn, { backgroundColor: colors.red + '22' }]}><Text style={[styles.actTxt, { color: colors.red }]}>Rifiuta</Text></View></PressableScale> : null}
        </View>
      </View>
    );
  };
  const repAttesa = repOp.filter((r) => r.stato === 'attesa');
  const repAppr = repOp.filter((r) => r.stato === 'approvata');
  const repRifi = repOp.filter((r) => r.stato === 'rifiutata');

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

  if (role === 'STAFF') {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <SheetHeader title="Reperibilità" subtitle="Invia la tua disponibilità" onClose={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <GlassCard style={{ marginBottom: 14 }}>
            <Text style={[styles.fLbl, { color: colors.text3 }]}>Data (GG/MM/AAAA)</Text>
            <View style={styles.dRow}>
              {([['gg', rgg, setRgg, 31, 1], ['mm', rmm, setRmm, 12, 1], ['aaaa', raaaa, setRaaaa, 9999, 2024]] as any[]).map(([k, val, set, max, min]) => (
                <View key={k} style={styles.dStep}>
                  <PressableScale onPress={() => set(Math.max(min, val - 1))}><View style={[styles.dBtn, { backgroundColor: colors.card2 }]}><Text style={styles.dSym}>−</Text></View></PressableScale>
                  <Text style={[styles.dVal, { color: colors.text }]}>{k === 'aaaa' ? val : pad2(val)}</Text>
                  <PressableScale onPress={() => set(Math.min(max, val + 1))}><View style={[styles.dBtn, { backgroundColor: colors.card2 }]}><Text style={styles.dSym}>+</Text></View></PressableScale>
                </View>
              ))}
            </View>
            <View style={styles.swRow}><Text style={[styles.fLbl, { color: colors.text2 }]}>Tutto il giorno</Text><Switch value={tuttoGiorno} onValueChange={setTuttoGiorno} /></View>
            {!tuttoGiorno ? <TextInput value={fasciaTxt} onChangeText={setFasciaTxt} placeholder="07:00-13:00" placeholderTextColor={colors.text3} style={[styles.in, { backgroundColor: colors.card2, borderColor: colors.line, color: colors.text }]} /> : null}
            <Text style={[styles.fLbl, { color: colors.text3, marginTop: 10 }]}>Telefono</Text>
            <TextInput value={tel} onChangeText={setTel} keyboardType="phone-pad" placeholder="+39…" placeholderTextColor={colors.text3} style={[styles.in, { backgroundColor: colors.card2, borderColor: colors.line, color: colors.text }]} />
            <Text style={[styles.fLbl, { color: colors.text3, marginTop: 10 }]}>Note</Text>
            <TextInput value={noteTxt} onChangeText={setNoteTxt} placeholder="Facoltative" placeholderTextColor={colors.text3} style={[styles.in, { backgroundColor: colors.card2, borderColor: colors.line, color: colors.text }]} />
            <Button title="Invia disponibilità" icon="call-outline" full onPress={submitRepOp} style={{ marginTop: 12 }} />
          </GlassCard>
          <SectionTitle title="Le mie disponibilità" />
          {myRepOp.length === 0 ? <Text style={[styles.repEmpty, { color: colors.text2 }]}>Nessuna disponibilità inviata.</Text> : myRepOp.map((r) => {
            const bc = badgeColorRep(r.stato, colors);
            return (
              <View key={r.id} style={[styles.opCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.opData, { color: colors.text }]}>{fmtIso(r.data)} · {r.fascia || 'Tutto il giorno'}</Text>
                  {r.note ? <Text style={[styles.opNote, { color: colors.text3 }]}>{r.note}</Text> : null}
                </View>
                <View style={[styles.badge, { backgroundColor: bc + '22', borderColor: bc }]}><Text style={[styles.badgeTxt, { color: bc }]}>{statoLabel(r.stato)}</Text></View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  if (!ctx.staff.length) {
    return (<View style={[styles.root, { backgroundColor: colors.bg }]}><SheetHeader title="Reperibilità" subtitle="Assegnazione e richiami" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} /><EmptyState icon="call-outline" title="Nessun operatore" desc="Aggiungi il personale per assegnare la reperibilità." /></View>);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Reperibilità" subtitle="Assegnazione, richiami, statistiche" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {repOp.length ? (
          <View style={{ marginBottom: 14 }}>
            {([['IN ATTESA', repAttesa], ['APPROVATE', repAppr], ['RIFIUTATE', repRifi]] as [string, ReperibilitaOperatore[]][]).map(([titolo, arr]) => arr.length ? (
              <View key={titolo} style={{ marginBottom: 4 }}>
                <SectionTitle title={`${titolo} (${arr.length})`} />
                {arr.map((r) => renderRepCard(r))}
              </View>
            ) : null)}
          </View>
        ) : null}
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
  fLbl: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  dRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  dStep: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dSym: { fontSize: 17, fontWeight: '800', color: '#4DA3FF' },
  dVal: { fontSize: 15, fontWeight: '800', minWidth: 30, textAlign: 'center' },
  swRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  in: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 6 },
  repEmpty: { fontSize: 13, marginTop: 8 },
  opCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  opData: { fontSize: 15, fontWeight: '800' },
  opNote: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  badge: { borderRadius: 9, borderWidth: 1, paddingVertical: 5, paddingHorizontal: 10 },
  badgeTxt: { fontSize: 11, fontWeight: '800' },
  opActions: { gap: 8 },
  actBtn: { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center' },
  actTxt: { fontSize: 13, fontWeight: '800' },
  root: { flex: 1 },
  warnTitle: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  warn: { fontSize: 12, marginTop: 2 },
  lbl: { fontSize: 12, marginBottom: 6 },
  chip: { paddingHorizontal: 14, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 160 },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  input: { flex: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  nome: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  rich: { fontSize: 11 },
  del: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  statN: { fontSize: 13, fontWeight: '700' },
  statV: { fontSize: 13 },
});
