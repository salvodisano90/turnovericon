// screens/AssistenteScreen.tsx — Assistente Coordinatore AI (offline, su dati reali)
import React from 'react';
import { useMemo, useState, useRef } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../hooks/useStore';
import { useToast } from '../hooks/useToast';
import Icon from '../components/Icon';
import {
  assistantQuery, classifyOperator, fatigueScore, publishGate, checkNeoassunti, proposeAllMatrici,
  AssistantAnswer,
} from '../services/engine';
import { OperatorClass } from '../types';

type Tab = 'chat' | 'personale' | 'criticita' | 'suggerimenti';

const QUICK = [
  'Chi ha fatto più notti?',
  'Chi è più sovraccarico?',
  'Quali turni sono scoperti?',
  'Ci sono turni con due neoassunti?',
  'Perché il piano non viene pubblicato?',
  'Cosa è lo smonto dopo la notte?',
];

function fatigueBand(score: number): { label: string; tone: 'green' | 'yellow' | 'red' } {
  if (score <= 25) return { label: 'basso', tone: 'green' };
  if (score <= 50) return { label: 'moderato', tone: 'yellow' };
  if (score <= 75) return { label: 'alto', tone: 'yellow' };
  return { label: 'critico', tone: 'red' };
}
function classTone(c: OperatorClass): 'green' | 'yellow' | 'red' {
  if (c === 'Referente' || c === 'Esperto') return 'green';
  if (c === 'Senior' || c === 'Junior') return 'yellow';
  return 'red';
}

export default function AssistenteScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { ctx, currentPiano, staff, applyMatriceProposals } = useStore();
  const [tab, setTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<{ q: string; a: AssistantAnswer }[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  const ask = (q: string) => {
    const question = q.trim();
    if (!question) return;
    const a = assistantQuery(ctx, currentPiano, question);
    setMsgs((m) => [...m, { q: question, a }]);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  };

  const profili = useMemo(() => staff.map((s) => {
    const cls = classifyOperator(s);
    const fat = fatigueScore(ctx, currentPiano).find((f) => f.infId === s.id);
    return { id: s.id, nome: s.nome, cls, fatigue: fat ? fat.score : 0 };
  }), [staff, ctx, currentPiano]);

  const neo = useMemo(() => checkNeoassunti(ctx, currentPiano), [ctx, currentPiano]);
  const gate = useMemo(() => publishGate(ctx, currentPiano, { coverageMin: 90 }), [ctx, currentPiano]);
  const proposte = useMemo(() => proposeAllMatrici(ctx), [ctx]);

  const repName = (id: string) => (ctx.reparti.find((r) => r.id === id)?.nome) || id;
  const toneColor = (t: 'green' | 'yellow' | 'red') => t === 'green' ? colors.green : t === 'red' ? colors.red : colors.yellow;
  const toneBg = (t: 'green' | 'yellow' | 'red') => t === 'green' ? colors.greenSoft : t === 'red' ? colors.redSoft : colors.yellowSoft;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <View style={styles.hLeft}>
          <Icon name="sparkles" size={22} color={colors.blue} />
          <Text style={[styles.hTitle, { color: colors.text }]}>Assistente Coordinatore AI</Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10}><Icon name="close" size={24} color={colors.text2} /></Pressable>
      </View>
      <Text style={[styles.hSub, { color: colors.text3 }]}>Funziona offline, sui dati reali dell'app.</Text>

      <View style={styles.tabs}>
        {([['chat', 'Chat'], ['personale', 'Personale'], ['criticita', 'Criticità'], ['suggerimenti', 'Suggerimenti']] as [Tab, string][]).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, { backgroundColor: tab === id ? colors.blue : colors.card, borderColor: colors.separator }]}>
            <Text style={[styles.tabTxt, { color: tab === id ? '#fff' : colors.text2 }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'chat' ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.body}>
            <View style={styles.quickWrap}>
              {QUICK.map((q) => (
                <Pressable key={q} onPress={() => ask(q)} style={[styles.chip, { backgroundColor: colors.blueSoft }]}>
                  <Text style={[styles.chipTxt, { color: colors.blue }]}>{q}</Text>
                </Pressable>
              ))}
            </View>
            {msgs.length === 0 ? (
              <Text style={[styles.hint, { color: colors.text3 }]}>Chiedi qualcosa, ad esempio chi ha più notti, chi può sostituire un operatore, perché il piano non è pubblicabile, o una regola (riposo 11h, smonto, ferie, 104, maternità, profili).</Text>
            ) : null}
            {msgs.map((m, i) => (
              <View key={i} style={{ marginBottom: 14 }}>
                <View style={[styles.bubbleQ, { backgroundColor: colors.blue }]}><Text style={styles.bubbleQTxt}>{m.q}</Text></View>
                <View style={[styles.bubbleA, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                  <Text style={[styles.aTitle, { color: colors.text }]}>{m.a.answer}</Text>
                  {(m.a.items || []).map((it, j) => (
                    <View key={j} style={styles.aRow}>
                      {it.nome ? <Text style={[styles.aName, { color: colors.text }]}>{it.nome}</Text> : null}
                      <Text style={[styles.aVal, { color: colors.text2 }]}>{it.valore}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.inputBar, { borderTopColor: colors.separator, backgroundColor: colors.bg }]}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.separator }]}
              placeholder="Scrivi una domanda…" placeholderTextColor={colors.text3}
              value={input} onChangeText={setInput} onSubmitEditing={() => ask(input)} returnKeyType="send"
            />
            <Pressable onPress={() => ask(input)} style={[styles.send, { backgroundColor: colors.blue }]}>
              <Icon name="arrow-redo" size={20} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {tab === 'personale' ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.sec, { color: colors.text2 }]}>Classificazione automatica e fatigue score</Text>
          {profili.map((p) => {
            const b = fatigueBand(p.fatigue); const ct = classTone(p.cls.categoria);
            return (
              <View key={p.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.name, { color: colors.text }]}>{p.nome}</Text>
                  <Text style={[styles.badge, { color: toneColor(ct), backgroundColor: toneBg(ct) }]}>{p.cls.categoria}</Text>
                </View>
                <Text style={[styles.motivo, { color: colors.text3 }]}>{p.cls.motivi.join(' · ')}</Text>
                <View style={styles.rowBetween}>
                  <Text style={[styles.small, { color: colors.text2 }]}>Fatigue</Text>
                  <Text style={[styles.badge, { color: toneColor(b.tone), backgroundColor: toneBg(b.tone) }]}>{p.fatigue}/100 · {b.label}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {tab === 'criticita' ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.sec, { color: colors.text2 }]}>Gate di pubblicazione</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
            <Text style={[styles.gateTop, { color: gate.ok ? colors.green : colors.red }]}>{gate.ok ? '✓ Piano pubblicabile' : '✗ Pubblicazione bloccata'}</Text>
            {gate.checks.map((c, i) => (
              <View key={i} style={styles.rowBetween}>
                <Text style={[styles.small, { color: colors.text }]}>{c.nome}</Text>
                <Text style={[styles.badge, { color: c.esito === 'fail' ? colors.red : c.esito === 'warn' ? colors.yellow : colors.green, backgroundColor: c.esito === 'fail' ? colors.redSoft : c.esito === 'warn' ? colors.yellowSoft : colors.greenSoft }]}>{c.dettaglio}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.sec, { color: colors.text2, marginTop: 18 }]}>Alert neoassunti (non bloccante)</Text>
          {neo.length === 0 ? (
            <Text style={[styles.hint, { color: colors.text3 }]}>Nessun turno composto esclusivamente da neoassunti.</Text>
          ) : neo.slice(0, 20).map((a, i) => (
            <View key={i} style={[styles.card, { backgroundColor: colors.yellowSoft, borderColor: colors.separator }]}>
              <Text style={[styles.name, { color: colors.text }]}>⚠ {repName(a.repartoId)} · g.{a.day} · {a.turno}</Text>
              <Text style={[styles.motivo, { color: colors.text2 }]}>{a.nomi.join(', ')}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {tab === 'suggerimenti' ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.sec, { color: colors.text2 }]}>Proposte di matrice (per profilo)</Text>
          {proposte.map((p) => (
            <View key={p.infId} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.name, { color: colors.text }]}>{p.nome}</Text>
                <Text style={[styles.badge, { color: colors.blue, backgroundColor: colors.blueSoft }]}>{p.label}</Text>
              </View>
              <Text style={[styles.motivo, { color: colors.text3 }]}>{p.classe} · {p.motivo}</Text>
            </View>
          ))}
          <Pressable
            onPress={() => { const n = applyMatriceProposals(); toast.show(n > 0 ? `${n} matrici aggiornate. Piano rigenerato.` : 'Tutte le matrici erano già allineate.', 'success'); }}
            style={[styles.applyBtn, { backgroundColor: colors.blue }]}
          >
            <Text style={styles.applyTxt}>Applica tutte le proposte</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  hLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hTitle: { fontSize: 18, fontWeight: '700' },
  hSub: { fontSize: 12, paddingHorizontal: 16, paddingTop: 4 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  tabTxt: { fontSize: 12, fontWeight: '600' },
  body: { padding: 16, paddingBottom: 32 },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  chipTxt: { fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  bubbleQ: { alignSelf: 'flex-end', maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, borderBottomRightRadius: 4, marginBottom: 6 },
  bubbleQTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  bubbleA: { alignSelf: 'flex-start', maxWidth: '95%', padding: 12, borderRadius: 16, borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  aTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  aRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 3 },
  aName: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  aVal: { fontSize: 13, textAlign: 'right', flexShrink: 1 },
  inputBar: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  input: { flex: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, borderWidth: StyleSheet.hairlineWidth },
  send: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sec: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 10, gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { fontSize: 15, fontWeight: '700' },
  small: { fontSize: 13 },
  motivo: { fontSize: 12 },
  badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  gateTop: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  applyBtn: { marginTop: 10, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  applyTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
