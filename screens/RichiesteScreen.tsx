// screens/RichiesteScreen.tsx — Richieste e Desiderate (multiutente, role-aware).
// OWNER: dashboard approvazioni + gestione accessi. STAFF: invio richieste + stato.
// Switch ruolo in-app per provare il flusso STAFF su un solo dispositivo.
import React from 'react';
import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../hooks/useStore';
import { useToast } from '../hooks/useToast';
import Icon from '../components/Icon';
import SelectChip from '../components/SelectChip';
import { sanitizeRequestsForStaff } from '../utils/privacy';
import Button from '../components/Button';
import Stepper from '../components/Stepper';
import { RequestType } from '../types';
import { can, roleLabel } from '../utils/permissions';
import { assessRequest } from '../services/engine';
import { MONTHS } from '../utils/constants';

const TIPI: { id: RequestType; label: string }[] = [
  { id: 'ferie', label: 'Ferie' },
  { id: 'riposo', label: 'Riposo' },
  { id: 'mattina', label: 'Pref. mattina' },
  { id: 'pomeriggio', label: 'Pref. pomeriggio' },
  { id: 'evitaNotte', label: 'Evita notte' },
];

export default function RichiesteScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { staff, requests, role, setRole, month, year, members, submitRequest, approveRequest, rejectRequest, ctx, currentPiano, currentEmail } = useStore();

  const [infId, setInfId] = useState<string>(staff[0]?.id || '');
  const myInfId = React.useMemo(() => { const m = members.find((x) => (x.email || '').trim().toLowerCase() === (currentEmail || '').trim().toLowerCase()); return m ? m.infId : undefined; }, [members, currentEmail]);
  React.useEffect(() => { if (role === 'STAFF' && myInfId) setInfId(myInfId); }, [role, myInfId]);
  const effInfId = role === 'STAFF' ? (myInfId || '') : infId;
  const [tipo, setTipo] = useState<RequestType>('ferie');
  const [day, setDay] = useState<number>(1);
  const [to, setTo] = useState<number>(1);
  const [motivo, setMotivo] = useState<string>('');

  const nomeOf = (id: string) => staff.find((s) => s.id === id)?.nome || id;
  const pending = useMemo(() => requests.filter((r) => r.stato === 'pending'), [requests]);
  const storico = useMemo(() => requests.filter((r) => r.stato !== 'pending'), [requests]);
  const [rejComment, setRejComment] = useState<Record<string, string>>({});
  const valutazioni = useMemo(() => {
    const m: Record<string, ReturnType<typeof assessRequest>> = {};
    if (can(role, 'approve')) for (const r of pending) { try { m[r.id] = assessRequest(ctx, currentPiano, r); } catch (e) { /* valutazione non disponibile */ } }
    return m;
  }, [pending, ctx, currentPiano, role]);
  const tone = (st: string) => st === 'approved' ? colors.green : st === 'rejected' ? colors.red : colors.yellow;
  const toneBg = (st: string) => st === 'approved' ? colors.greenSoft : st === 'rejected' ? colors.redSoft : colors.yellowSoft;
  const stLabel = (st: string) => st === 'approved' ? 'Approvata' : st === 'rejected' ? 'Respinta' : 'In attesa';
  const tipoLabel = (t: string) => TIPI.find((x) => x.id === t)?.label || t;
  const giorni = (r: { day: number; to?: number }) => r.to && r.to > r.day ? `${r.day}–${r.to}` : `${r.day}`;
  const ini = (n: string) => (n || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const quaOf = (id: string) => (staff.find((x) => x.id === id)?.qualifica) || 'Operatore';

  const send = () => {
    if (!effInfId) { toast.show(role === 'STAFF' ? 'La tua email non è collegata a un operatore' : 'Seleziona un operatore', 'error'); return; }
    submitRequest({ infId: effInfId, day, to: tipo === 'ferie' ? Math.max(to, day) : undefined, month, year, tipo, motivo: motivo.trim() || undefined });
    toast.show('Richiesta inviata', 'success'); setMotivo('');
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <Text style={[styles.title, { color: colors.text }]}>Richieste e Desiderate</Text>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={10}><Icon name="close" size={24} color={colors.text2} /></Pressable>
      </View>

      {/* Switch ruolo (anteprima) */}
      <View style={[styles.roleBar, { backgroundColor: colors.card2 }]}>
        <Text style={[styles.roleLbl, { color: colors.text3 }]}>Vista</Text>
        {(['OWNER', 'STAFF'] as const).map((r) => (
          <Pressable key={r} onPress={() => setRole(r)} style={[styles.roleBtn, { backgroundColor: role === r ? colors.blue : 'transparent' }]}>
            <Text style={{ color: role === r ? '#fff' : colors.text2, fontWeight: '700', fontSize: 12 }}>{roleLabel(r)}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {role === 'STAFF' && (
          <>
            <Text style={[styles.sec, { color: colors.text2 }]}>Nuova richiesta · {MONTHS[month]} {year}</Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
              <Text style={[styles.lbl, { color: colors.text }]}>Richiesta per</Text>
              <View style={[styles.card, { backgroundColor: colors.card2, borderColor: colors.separator, marginTop: 6 }]}>
                <Text style={[styles.name, { color: colors.text }]}>{myInfId ? nomeOf(myInfId) : 'Operatore non associato'}</Text>
                <Text style={[styles.motivo, { color: colors.text3 }]}>{myInfId ? 'Puoi inviare richieste solo per te stesso' : 'Chiedi al coordinatore di collegare la tua email a un operatore'}</Text>
              </View>
              <Text style={[styles.lbl, { color: colors.text, marginTop: 12 }]}>Tipo</Text>
              <View style={styles.chips}>
                {TIPI.map((t) => <SelectChip key={t.id} label={t.label} selected={tipo === t.id} onPress={() => setTipo(t.id)} />)}
              </View>
              <View style={styles.rowBetween}>
                <Text style={[styles.lbl, { color: colors.text }]}>{tipo === 'ferie' ? 'Dal giorno' : 'Giorno'}</Text>
                <Stepper value={day} onChange={(d) => setDay(Math.min(Math.max(1, day + d), 31))} />
              </View>
              {tipo === 'ferie' ? (
                <View style={styles.rowBetween}>
                  <Text style={[styles.lbl, { color: colors.text }]}>Al giorno</Text>
                  <Stepper value={Math.max(to, day)} onChange={(d) => setTo(Math.min(Math.max(day, Math.max(to, day) + d), 31))} />
                </View>
              ) : null}
              <Text style={[styles.lbl, { color: colors.text, marginTop: 8 }]}>Motivazione (opzionale)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.card2, color: colors.text, borderColor: colors.separator }]} placeholder="Es. visita medica" placeholderTextColor={colors.text3} value={motivo} onChangeText={setMotivo} />
              <Button title="Invia richiesta" onPress={send} full style={{ marginTop: 12 }} />
            </View>

            <Text style={[styles.sec, { color: colors.text2, marginTop: 18 }]}>Le mie richieste</Text>
            {(role === 'STAFF' ? sanitizeRequestsForStaff(requests, myInfId) : requests.filter((r) => r.infId === infId)).length === 0 ? (
              <Text style={[styles.hint, { color: colors.text3 }]}>Nessuna richiesta inviata per questo operatore.</Text>
            ) : (role === 'STAFF' ? sanitizeRequestsForStaff(requests, myInfId) : requests.filter((r) => r.infId === infId)).map((r) => (
              <View key={r.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.name, { color: colors.text }]}>{tipoLabel(r.tipo)} · g.{giorni(r)}</Text>
                  <Text style={[styles.badge, { color: tone(r.stato), backgroundColor: toneBg(r.stato) }]}>{stLabel(r.stato)}</Text>
                </View>
                {r.commento ? <Text style={[styles.motivo, { color: colors.text3 }]}>Nota: {r.commento}</Text> : null}
              </View>
            ))}
          </>
        )}
        {can(role, 'approve') && (
          <>
            <Text style={[styles.sec, { color: colors.text2 }]}>Richieste in attesa ({pending.length})</Text>
            {pending.length === 0 ? (
              <Text style={[styles.hint, { color: colors.text3 }]}>Nessuna richiesta da approvare.</Text>
            ) : pending.map((r) => {
              const v = valutazioni[r.id];
              const impCol = v ? (v.impatto === 'basso' ? colors.green : v.impatto === 'medio' ? colors.yellow : colors.red) : colors.text3;
              const impBg = v ? (v.impatto === 'basso' ? colors.greenSoft : v.impatto === 'medio' ? colors.yellowSoft : colors.redSoft) : colors.card2;
              return (
              <View key={r.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                <View style={styles.mailHead}>
                  <View style={[styles.mailAvatar, { backgroundColor: colors.blue }]}><Text style={styles.mailAvatarTxt}>{ini(nomeOf(r.infId))}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{nomeOf(r.infId)}</Text>
                    <Text style={[styles.mailSub, { color: colors.text3 }]} numberOfLines={1}>{quaOf(r.infId)} · {tipoLabel(r.tipo)} · {giorni(r)} {MONTHS[r.month]}</Text>
                  </View>
                  <View style={[styles.statoChip, { backgroundColor: colors.yellowSoft }]}><Text style={[styles.statoTxt, { color: colors.yellow }]}>Da approvare</Text></View>
                </View>
                {r.motivo ? <Text style={[styles.motivo, { color: colors.text3 }]}>{r.motivo}</Text> : null}
                {v ? (
                  <View style={[styles.ai, { backgroundColor: impBg, borderColor: impCol }]}>
                    <View style={styles.rowBetween}>
                      <Text style={[styles.aiTitle, { color: impCol }]}>Valutazione AI</Text>
                      <Text style={[styles.aiImp, { color: impCol }]}>impatto {v.impatto}</Text>
                    </View>
                    <Text style={[styles.aiTxt, { color: colors.text2 }]}>Copertura {v.coperturaPrima}% → {v.coperturaResidua}%{v.sostituto ? ` · sostituto: ${v.sostituto}` : ''}</Text>
                    <Text style={[styles.aiTxt, { color: colors.text2 }]}>{v.nota}</Text>
                  </View>
                ) : null}
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card2, color: colors.text, borderColor: colors.separator, marginTop: 8 }]}
                  placeholder="Motivazione (obbligatoria per respingere)"
                  placeholderTextColor={colors.text3}
                  value={rejComment[r.id] || ''}
                  onChangeText={(t) => setRejComment((m) => ({ ...m, [r.id]: t }))}
                />
                <View style={[styles.rowBetween, { marginTop: 8 }]}>
                  <Button title="Approva" small variant="primary" onPress={() => { approveRequest(r.id, (rejComment[r.id] || '').trim() || undefined); toast.show('Richiesta approvata e applicata al piano', 'success'); }} style={{ flex: 1, marginRight: 6 }} />
                  <Button title="Respingi" small variant="danger" onPress={() => {
                    const c = (rejComment[r.id] || '').trim();
                    if (c.length < 3) { toast.show('Inserisci una motivazione per respingere', 'error'); return; }
                    rejectRequest(r.id, c); toast.show('Richiesta respinta', 'warning');
                  }} style={{ flex: 1, marginLeft: 6 }} />
                </View>
              </View>
              );
            })}
          </>
        )}
        {can(role, 'invite') && (
          <>
            <Text style={[styles.sec, { color: colors.text2, marginTop: 18 }]}>Utenti autorizzati</Text>
            <Button title="Gestisci utenti autorizzati" small full icon="people-outline" onPress={() => router.push('/utenti-autorizzati')} />

            {storico.length ? (
              <>
                <Text style={[styles.sec, { color: colors.text2, marginTop: 18 }]}>Storico</Text>
                {storico.slice(0, 30).map((r) => (
                  <View key={r.id} style={[styles.rowBetween, styles.histRow, { borderBottomColor: colors.separator }]}>
                    <Text style={[styles.motivo, { color: colors.text2 }]} numberOfLines={1}>{nomeOf(r.infId)} · {tipoLabel(r.tipo)} g.{giorni(r)}</Text>
                    <Text style={[styles.badge, { color: tone(r.stato), backgroundColor: toneBg(r.stato) }]}>{stLabel(r.stato)}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mailHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mailAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  mailAvatarTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  mailSub: { fontSize: 12, marginTop: 2 },
  statoChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 11 },
  statoTxt: { fontSize: 11, fontWeight: '800' },
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '700' },
  roleBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 10, padding: 4, borderRadius: 12 },
  roleLbl: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8 },
  roleBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  body: { padding: 16, paddingBottom: 32 },
  sec: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 12 },
  lbl: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: StyleSheet.hairlineWidth },
  hint: { fontSize: 13, lineHeight: 19 },
  name: { fontSize: 15, fontWeight: '700' },
  motivo: { fontSize: 12, marginTop: 3 },
  ai: { marginTop: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  aiTitle: { fontSize: 13, fontWeight: '800' },
  aiImp: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  aiTxt: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  del: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  histRow: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 0 },
});
