// screens/PostazioniScreen.tsx — definizione postazioni operative per reparto

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import SheetHeader from '../components/SheetHeader';
import Card from '../components/Card';
import SectionTitle from '../components/SectionTitle';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import { Postazione, RepartoMinimi, StationPriority, TurnoLavoro } from '../types';

const PRIOS: StationPriority[] = ['critica', 'alta', 'media', 'bassa'];
const TURNI: TurnoLavoro[] = ['M', 'P', 'N'];

export default function PostazioniScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { reparti, updateReparto } = useStore();

  const [repId, setRepId] = useState<string | null>(reparti.length ? reparti[0].id : null);
  const rep = useMemo(() => reparti.find((r) => r.id === repId) || null, [reparti, repId]);
  const [list, setList] = useState<Postazione[]>([]);
  const [minimi, setMinimi] = useState<RepartoMinimi>({});

  useEffect(() => { setList(rep && rep.postazioni ? JSON.parse(JSON.stringify(rep.postazioni)) : []); setMinimi(rep && rep.minimi ? { ...rep.minimi } : {}); }, [repId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upd = (i: number, patch: Partial<Postazione>) => setList((l) => l.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const updReq = (i: number, patch: Record<string, any>) => setList((l) => l.map((p, k) => (k === i ? { ...p, requisiti: { ...(p.requisiti || {}), ...patch } } : p)));
  const toggleTurno = (i: number, t: TurnoLavoro) => setList((l) => l.map((p, k) => { if (k !== i) return p; const has = p.turni.indexOf(t) >= 0; return { ...p, turni: has ? p.turni.filter((x) => x !== t) : [...p.turni, t] }; }));
  const add = () => setList((l) => [...l, { id: 'st_' + Date.now().toString(36) + l.length, nome: 'Nuova postazione', turni: ['M'], priorita: 'media', requisiti: {}, quantita: 1 }]);
  const del = (i: number) => setList((l) => l.filter((_, k) => k !== i));

  const salva = () => {
    if (!rep) { toast.show('Crea prima un reparto', 'error'); return; }
    if (list.some((p) => !p.nome.trim())) { toast.show('Ogni postazione deve avere un nome', 'error'); return; }
    if (list.some((p) => !p.turni.length)) { toast.show('Ogni postazione deve avere almeno un turno', 'error'); return; }
    updateReparto({ ...rep, postazioni: list, minimi });
    toast.show('Postazioni salvate', 'success');
    router.back();
  };

  const MinStep = ({ value, onDelta }: { value: number; onDelta: (d: number) => void }) => (
    <View style={styles.stepper}>
      <Pressable hitSlop={8} onPress={() => onDelta(-1)} style={[styles.stepBtn, { backgroundColor: colors.card2, borderColor: colors.separator }]}><Icon name="remove" size={16} color={colors.text} /></Pressable>
      <Text style={[styles.stepVal, { color: colors.text }]}>{value}</Text>
      <Pressable hitSlop={8} onPress={() => onDelta(1)} style={[styles.stepBtn, { backgroundColor: colors.card2, borderColor: colors.separator }]}><Icon name="add" size={16} color={colors.text} /></Pressable>
    </View>
  );
  const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: on ? colors.blueSoft : colors.card2, borderColor: on ? colors.blue : colors.separator }]}>
      <Text style={[styles.chipTxt, { color: on ? colors.blue : colors.text2 }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Postazioni operative" subtitle="Definisci le postazioni reali del reparto e i requisiti" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>

        {!reparti.length ? (
          <EmptyState icon="business-outline" title="Nessun reparto" desc="Crea prima un reparto." />
        ) : (
          <>
            <SectionTitle>Reparto</SectionTitle>
            <View style={styles.row}>
              {reparti.map((r) => <Chip key={r.id} label={r.nome} on={r.id === repId} onPress={() => setRepId(r.id)} />)}
            </View>

            <SectionTitle>Copertura minima garantita</SectionTitle>
            <Card>
              <View style={styles.stepRow}>
                <View style={styles.stepCol}><Text style={[styles.lbl, { color: colors.text3 }]}>Critiche min</Text><MinStep value={minimi.criticheMin || 0} onDelta={(d) => setMinimi((m) => ({ ...m, criticheMin: Math.max(0, (m.criticheMin || 0) + d) }))} /></View>
                <View style={styles.stepCol}><Text style={[styles.lbl, { color: colors.text3 }]}>Alte min</Text><MinStep value={minimi.alteMin || 0} onDelta={(d) => setMinimi((m) => ({ ...m, alteMin: Math.max(0, (m.alteMin || 0) + d) }))} /></View>
              </View>
              <View style={[styles.stepRow, { marginTop: 10 }]}>
                <View style={styles.stepCol}><Text style={[styles.lbl, { color: colors.text3 }]}>Infermieri min</Text><MinStep value={minimi.infMin || 0} onDelta={(d) => setMinimi((m) => ({ ...m, infMin: Math.max(0, (m.infMin || 0) + d) }))} /></View>
                <View style={styles.stepCol}><Text style={[styles.lbl, { color: colors.text3 }]}>OSS min</Text><MinStep value={minimi.ossMin || 0} onDelta={(d) => setMinimi((m) => ({ ...m, ossMin: Math.max(0, (m.ossMin || 0) + d) }))} /></View>
              </View>
            </Card>

            {list.map((p, i) => (
              <Card key={p.id} style={{ marginTop: 14 }}>
                <View style={styles.cardHead}>
                  <TextInput value={p.nome} onChangeText={(t) => upd(i, { nome: t })} placeholder="Nome postazione" placeholderTextColor={colors.text3} style={[styles.nameInput, { color: colors.text, borderColor: colors.separator }]} />
                  <Pressable hitSlop={8} onPress={() => del(i)}><Icon name="trash-outline" size={20} color={colors.red} /></Pressable>
                </View>

                <Text style={[styles.lbl, { color: colors.text3 }]}>Turni attivi</Text>
                <View style={styles.row}>{TURNI.map((t) => <Chip key={t} label={t} on={p.turni.indexOf(t) >= 0} onPress={() => toggleTurno(i, t)} />)}</View>

                <Text style={[styles.lbl, { color: colors.text3 }]}>Priorità</Text>
                <View style={styles.row}>{PRIOS.map((pr) => <Chip key={pr} label={pr} on={p.priorita === pr} onPress={() => upd(i, { priorita: pr })} />)}</View>

                <Text style={[styles.lbl, { color: colors.text3 }]}>Ruolo richiesto</Text>
                <View style={styles.row}>
                  <Chip label="Infermiere" on={p.requisiti?.ruolo === 'infermiere'} onPress={() => updReq(i, { ruolo: p.requisiti?.ruolo === 'infermiere' ? undefined : 'infermiere' })} />
                  <Chip label="OSS" on={p.requisiti?.ruolo === 'oss'} onPress={() => updReq(i, { ruolo: p.requisiti?.ruolo === 'oss' ? undefined : 'oss' })} />
                </View>

                <Text style={[styles.lbl, { color: colors.text3 }]}>Requisiti aggiuntivi</Text>
                <View style={styles.row}>
                  <Chip label="Senior" on={!!p.requisiti?.senior} onPress={() => updReq(i, { senior: !p.requisiti?.senior })} />
                  <Chip label="Referente" on={!!p.requisiti?.referente} onPress={() => updReq(i, { referente: !p.requisiti?.referente })} />
                </View>

                <View style={styles.stepRow}>
                  <View style={styles.stepCol}>
                    <Text style={[styles.lbl, { color: colors.text3 }]}>Anzianità min (anni)</Text>
                    <View style={styles.stepper}>
                      <Pressable hitSlop={8} onPress={() => updReq(i, { anniMin: Math.max(0, (p.requisiti?.anniMin || 0) - 1) })} style={[styles.stepBtn, { backgroundColor: colors.card2, borderColor: colors.separator }]}><Icon name="remove" size={16} color={colors.text} /></Pressable>
                      <Text style={[styles.stepVal, { color: colors.text }]}>{p.requisiti?.anniMin || 0}</Text>
                      <Pressable hitSlop={8} onPress={() => updReq(i, { anniMin: (p.requisiti?.anniMin || 0) + 1 })} style={[styles.stepBtn, { backgroundColor: colors.card2, borderColor: colors.separator }]}><Icon name="add" size={16} color={colors.text} /></Pressable>
                    </View>
                  </View>
                  <View style={styles.stepCol}>
                    <Text style={[styles.lbl, { color: colors.text3 }]}>Operatori richiesti</Text>
                    <View style={styles.stepper}>
                      <Pressable hitSlop={8} onPress={() => upd(i, { quantita: Math.max(1, (p.quantita || 1) - 1) })} style={[styles.stepBtn, { backgroundColor: colors.card2, borderColor: colors.separator }]}><Icon name="remove" size={16} color={colors.text} /></Pressable>
                      <Text style={[styles.stepVal, { color: colors.text }]}>{p.quantita || 1}</Text>
                      <Pressable hitSlop={8} onPress={() => upd(i, { quantita: (p.quantita || 1) + 1 })} style={[styles.stepBtn, { backgroundColor: colors.card2, borderColor: colors.separator }]}><Icon name="add" size={16} color={colors.text} /></Pressable>
                    </View>
                  </View>
                </View>
              </Card>
            ))}

            <View style={{ height: 14 }} />
            <Button title="Aggiungi postazione" variant="secondary" full icon="add-circle-outline" onPress={add} />
            <View style={{ height: 10 }} />
            <Button title="Salva postazioni" full icon="save-outline" onPress={salva} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 4 },
  chip: { paddingHorizontal: 12, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipTxt: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: { flex: 1, fontSize: 16, fontWeight: '700', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  lbl: { fontSize: 12, marginTop: 10 },
  stepRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  stepCol: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  stepBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 18, fontWeight: '800', minWidth: 28, textAlign: 'center' },
});
