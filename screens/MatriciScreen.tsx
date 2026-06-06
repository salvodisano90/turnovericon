// screens/MatriciScreen.tsx — catalogo matrici + costruttore di matrici personalizzate

import React, { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../components/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { confirmAction } from '../utils/confirm';
import { Matrice, Turno } from '../types';
import { MATRICI } from '../utils/constants';
import SheetHeader from '../components/SheetHeader';
import Card from '../components/Card';
import SectionTitle from '../components/SectionTitle';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';

// Turni componibili in una matrice (F = assenza, non fa parte della turnazione ciclica).
const PALETTE: Turno[] = ['M', 'P', 'N', 'S', 'R', 'G'];

export default function MatriciScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { matriciCustom, addMatriceCustom, removeMatriceCustom } = useStore();

  const [nome, setNome] = useState('');
  const [descr, setDescr] = useState('');
  const [seq, setSeq] = useState<Turno[]>([]);

  const catalogo = useMemo(() => [...MATRICI, ...matriciCustom], [matriciCustom]);
  const notti = seq.filter((t) => t === 'N').length;

  const seqChips = (s: Turno[]) => (
    <View style={styles.seq}>
      {s.map((tt, i) => (
        <View key={i} style={[styles.blk, { backgroundColor: colors.shift[tt].bg }]}>
          <Text style={[styles.blkTxt, { color: colors.shift[tt].fg }]}>{tt}</Text>
        </View>
      ))}
    </View>
  );

  const salva = () => {
    const label = nome.trim();
    if (label.length < 2) { toast.show('Inserisci un nome per la matrice', 'error'); return; }
    if (seq.length < 2) { toast.show('La sequenza deve avere almeno 2 giorni', 'error'); return; }
    const slug = label.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CUSTOM';
    const id = slug + Date.now().toString(36).slice(-4).toUpperCase();
    const m: Matrice = { id, label, seq: seq.slice(), notti, durata: seq.length, descrizione: descr.trim() || undefined, custom: true };
    addMatriceCustom(m);
    setNome(''); setDescr(''); setSeq([]);
    toast.show('Matrice salvata nel catalogo', 'success');
  };

  const elimina = (m: Matrice) => {
    confirmAction('Elimina matrice', `Eliminare la matrice personalizzata "${m.label}"?`, () => {
      removeMatriceCustom(m.id);
      toast.show('Matrice eliminata', 'success');
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Matrice utilizzata" subtitle="Catalogo matrici contrattuali e personalizzate" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>

        <SectionTitle>Nuova matrice personalizzata</SectionTitle>
        <Card>
          <Text style={[styles.lbl, { color: colors.text2 }]}>Nome</Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Es. Aziendale Reparto A"
            placeholderTextColor={colors.text2}
            style={[styles.input, { color: colors.text, backgroundColor: colors.card2, borderColor: colors.separator }]}
          />
          <Text style={[styles.lbl, { color: colors.text2, marginTop: 12 }]}>Descrizione (opzionale)</Text>
          <TextInput
            value={descr}
            onChangeText={setDescr}
            placeholder="Note sulla turnazione"
            placeholderTextColor={colors.text2}
            style={[styles.input, { color: colors.text, backgroundColor: colors.card2, borderColor: colors.separator }]}
          />
          <Text style={[styles.lbl, { color: colors.text2, marginTop: 12 }]}>Sequenza ciclo ({seq.length} giorni{notti ? ` · ${notti}N` : ''})</Text>
          <View style={styles.palette}>
            {PALETTE.map((t) => (
              <Pressable key={t} onPress={() => setSeq((p) => [...p, t])} style={[styles.pBtn, { backgroundColor: colors.shift[t].bg, borderColor: colors.separator }]}>
                <Text style={[styles.pTxt, { color: colors.shift[t].fg }]}>{t}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setSeq((p) => p.slice(0, -1))} style={[styles.pBtn, { backgroundColor: colors.card2, borderColor: colors.separator }]}>
              <Icon name="backspace-outline" size={18} color={colors.text2} />
            </Pressable>
          </View>
          {seq.length ? <View style={{ marginTop: 10 }}>{seqChips(seq)}</View> : <Text style={[styles.hint, { color: colors.text2 }]}>Tocca i turni per comporre il ciclo (es. M M P P R N N S R R).</Text>}
          <View style={{ height: 12 }} />
          <Button title="Salva nel catalogo" onPress={salva} />
        </Card>

        <View style={{ height: 18 }} />
        <SectionTitle>Catalogo ({catalogo.length})</SectionTitle>
        {catalogo.map((m) => (
          <Card key={m.id} style={{ marginBottom: 10 }}>
            <View style={styles.row}>
              <Text style={[styles.title, { color: colors.text }]}>{m.label}</Text>
              <View style={styles.tags}>
                <Text style={[styles.tag, { color: colors.text2, backgroundColor: colors.card2 }]}>ciclo {m.durata || m.seq.length}</Text>
                <Text style={[styles.tag, { color: colors.text2, backgroundColor: colors.card2 }]}>{m.notti}N</Text>
                {m.custom ? <Text style={[styles.tag, { color: colors.green, backgroundColor: colors.greenSoft }]}>personalizzata</Text> : null}
              </View>
            </View>
            <View style={{ marginTop: 8 }}>{seqChips(m.seq)}</View>
            {m.descrizione ? <Text style={[styles.descr, { color: colors.text2 }]}>{m.descrizione}</Text> : null}
            {m.custom ? (
              <Pressable onPress={() => elimina(m)} style={styles.del}>
                <Icon name="trash-outline" size={16} color={colors.red} />
                <Text style={[styles.delTxt, { color: colors.red }]}>Elimina</Text>
              </Pressable>
            ) : null}
          </Card>
        ))}
        {!catalogo.length ? <EmptyState icon="grid-outline" title="Nessuna matrice" desc="Crea la prima matrice personalizzata." /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  lbl: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 6 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pBtn: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pTxt: { fontSize: 16, fontWeight: '800' },
  hint: { fontSize: 13, marginTop: 8 },
  seq: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  blk: { minWidth: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  blkTxt: { fontSize: 13, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  title: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  descr: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  del: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  delTxt: { fontSize: 13, fontWeight: '600' },
});
