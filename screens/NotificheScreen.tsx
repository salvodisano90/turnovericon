// screens/NotificheScreen.tsx — Centro notifiche del coordinatore.
// Richieste pendenti (ferie/desiderata/indisponibilità/modifiche): nome, data, tipo, stato + Approva/Rifiuta.

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import { can } from '../utils/permissions';
import EmptyState from '../components/EmptyState';

const TIPO: Record<string, string> = { ferie: 'Ferie', permesso: 'Permesso', riposo: 'Riposo', indisponibilita: 'Indisponibilità', cambio: 'Cambio turno', desiderata: 'Desiderata' };
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export default function NotificheScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { requests, staff, approveRequest, rejectRequest, role, members, currentEmail } = useStore();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const myInfId = useMemo(() => { const m = (members || []).find((x) => (x.email || '').trim().toLowerCase() === (currentEmail || '').trim().toLowerCase()); return m ? m.infId : undefined; }, [members, currentEmail]);
  const pending = useMemo(() => {
    const base = role === 'STAFF' ? (requests || []).filter((r) => r.infId === myInfId) : (requests || []).filter((r) => r.stato === 'pending');
    return [...base].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [requests, role, myInfId]);
  const nomeOf = (id: string) => (staff.find((s) => s.id === id)?.nome) || 'Operatore';
  const giorni = (r: any) => (r.to && r.to !== r.day ? `${r.day}–${r.to}` : `${r.day}`) + ` ${MESI[r.month] || ''}`;

  const doReject = (id: string) => {
    if (comment.trim().length < 3) { toast.show('Inserisci una motivazione (min 3 caratteri)', 'error'); return; }
    rejectRequest(id, comment.trim()); setRejectId(null); setComment(''); toast.show('Richiesta rifiutata', 'warning');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Notifiche" subtitle={pending.length ? `${pending.length} da gestire` : 'Tutto gestito'} onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {pending.length ? pending.map((r) => (
          <GlassCard key={r.id} style={{ marginBottom: 10 }}>
            <View style={styles.row}>
              <View style={[styles.icon, { backgroundColor: colors.blueSoft }]}><Icon name="mail-unread-outline" size={18} color={colors.blue} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{nomeOf(r.infId)}</Text>
                <Text style={[styles.meta, { color: colors.text3 }]}>{TIPO[r.tipo] || r.tipo} · {giorni(r)}{r.motivo ? ` · ${r.motivo}` : ''}</Text>
              </View>
              {(() => { const c = r.stato === 'approved' ? colors.green : r.stato === 'rejected' ? colors.red : colors.yellow; const lbl = r.stato === 'approved' ? 'Approvata' : r.stato === 'rejected' ? 'Rifiutata' : 'In attesa'; return (<View style={[styles.statePill, { backgroundColor: c + '22' }]}><Text style={[styles.stateTxt, { color: c }]}>{lbl}</Text></View>); })()}
            </View>
            {can(role, 'approve') && (rejectId === r.id ? (
              <View style={{ marginTop: 10 }}>
                <TextInput style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.card2 }]} placeholder="Motivazione del rifiuto (visibile al richiedente)" placeholderTextColor={colors.text3} value={comment} onChangeText={setComment} multiline />
                <View style={styles.btns}><Button title="Conferma rifiuto" small variant="danger" onPress={() => doReject(r.id)} /><Button title="Annulla" small variant="ghost" onPress={() => { setRejectId(null); setComment(''); }} /></View>
              </View>
            ) : (
              <View style={styles.btns}>
                <Button title="Approva" small icon="checkmark-outline" onPress={() => { approveRequest(r.id); toast.show('Richiesta approvata', 'success'); }} />
                <Button title="Rifiuta" small variant="soft" icon="close-outline" onPress={() => { setRejectId(r.id); setComment(''); }} />
              </View>
            ))}
          </GlassCard>
        )) : <EmptyState icon="notifications-off-outline" title="Nessuna notifica" desc="Le richieste del personale compariranno qui." />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  statePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9 },
  stateTxt: { fontSize: 11, fontWeight: '700' },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, borderWidth: 1, minHeight: 60, textAlignVertical: 'top' },
  btns: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
