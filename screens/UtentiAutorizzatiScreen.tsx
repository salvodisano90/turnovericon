// screens/UtentiAutorizzatiScreen.tsx — gestione utenti autorizzati (Impostazioni → Utenti autorizzati).
// Aggiungi / modifica / elimina email Staff + attiva/disattiva accesso. Tutto persistito.

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import PressableScale from '../components/PressableScale';
import Button from '../components/Button';
import SectionTitle from '../components/SectionTitle';
import EmptyState from '../components/EmptyState';

export default function UtentiAutorizzatiScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { members, staff, inviteMember, updateMember, removeMember } = useStore();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [selOp, setSelOp] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => { setNome(''); setEmail(''); setSelOp(undefined); setEditingId(null); };
  const save = () => {
    const e = email.trim();
    if (!e || !e.includes('@')) { toast.show('Inserisci una email valida', 'error'); return; }
    if (!selOp) { toast.show('Seleziona l\u2019operatore associato', 'error'); return; }
    const dup = members.find((m) => m.email.trim().toLowerCase() === e.toLowerCase() && m.id !== editingId);
    if (dup) { toast.show('Email già presente', 'error'); return; }
    const opDup = members.find((m) => m.infId === selOp && m.id !== editingId && m.stato !== 'revocato');
    if (opDup) { toast.show('Operatore già collegato a un\u2019altra email', 'error'); return; }
    const opName = staff.find((s) => s.id === selOp)?.nome || nome.trim() || e;
    if (editingId) { updateMember(editingId, { nome: opName, email: e, infId: selOp }); toast.show('Utente aggiornato', 'success'); }
    else { inviteMember({ nome: opName, email: e, ruolo: 'STAFF', infId: selOp }); toast.show('Utente autorizzato aggiunto', 'success'); }
    reset();
  };
  const edit = (id: string) => { const m = members.find((x) => x.id === id); if (!m) return; setEditingId(id); setNome(m.nome); setEmail(m.email); setSelOp(m.infId); };
  // Utenti autorizzati = tutti i membri tranne il coordinatore (OWNER). Gli inviti hanno sempre ruolo 'STAFF'.
  const autorizzati = members.filter((m) => m.ruolo !== 'OWNER');

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Utenti autorizzati" subtitle="Chi può accedere come Staff" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>

        <SectionTitle>{editingId ? 'Modifica utente' : 'Aggiungi utente'}</SectionTitle>
        <GlassCard>
          <Text style={[styles.lbl, { color: colors.text3 }]}>Email autorizzata</Text>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.card2 }]} placeholder="email@ospedale.it" placeholderTextColor={colors.text3} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Text style={[styles.lbl, { color: colors.text3, marginTop: 12 }]}>Operatore associato</Text>
          {staff.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {staff.map((s) => {
                const on = selOp === s.id;
                return (
                  <PressableScale key={s.id} onPress={() => setSelOp(s.id)}>
                    <View style={[styles.opChip, { backgroundColor: on ? colors.blue : colors.card2, borderColor: on ? colors.blue : colors.separator }]}>
                      <Text style={{ color: on ? '#fff' : colors.text2, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{s.nome}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
          ) : <Text style={[styles.hint, { color: colors.text3 }]}>Aggiungi prima il personale (scheda Staff) per poterlo associare.</Text>}
          <View style={styles.formBtns}>
            <Button title={editingId ? 'Salva' : 'Aggiungi'} icon={editingId ? 'save-outline' : 'add'} onPress={save} />
            {editingId ? <Button title="Annulla" variant="ghost" onPress={reset} /> : null}
          </View>
        </GlassCard>

        <SectionTitle>Autorizzati ({autorizzati.length})</SectionTitle>
        {autorizzati.length ? autorizzati.map((m) => {
          const attivo = m.stato !== 'revocato';
          return (
            <GlassCard key={m.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.email, { color: colors.text }]} numberOfLines={1}>{m.email}</Text>
                <Text style={[styles.meta, { color: colors.text3 }]}>{m.nome || 'Staff'} · {attivo ? 'attivo' : 'disattivato'}</Text>
              </View>
              <Switch value={attivo} onValueChange={(v) => updateMember(m.id, { stato: v ? 'attivo' : 'revocato' })} />
              <PressableScale onPress={() => edit(m.id)} hitSlop={6} style={[styles.iconBtn, { backgroundColor: colors.card2 }]}><Icon name="pencil" size={15} color={colors.text2} /></PressableScale>
              <PressableScale onPress={() => { removeMember(m.id); toast.show('Utente eliminato', 'warning'); if (editingId === m.id) reset(); }} hitSlop={6} style={[styles.iconBtn, { backgroundColor: colors.redSoft }]}><Icon name="trash" size={15} color={colors.red} /></PressableScale>
            </GlassCard>
          );
        }) : <EmptyState icon="people-outline" title="Nessun utente autorizzato" desc="Aggiungi le email del personale che potrà accedere come Staff." />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  lbl: { fontSize: 12, marginBottom: 6 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, borderWidth: 1 },
  formBtns: { flexDirection: 'row', gap: 8, marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  email: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  opChip: { paddingHorizontal: 14, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 160 },
});
