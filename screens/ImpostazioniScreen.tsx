// screens/ImpostazioniScreen.tsx — modalità di generazione del motore (persistente)

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { GenerationMode, PlanMode } from '../types';
import { MATRICI, MONTHS } from '../utils/constants';
import { monthKey } from '../utils/helpers';
import SheetHeader from '../components/SheetHeader';
import Card from '../components/Card';
import SectionTitle from '../components/SectionTitle';
import OptionCard from '../components/OptionCard';

const MODES: { id: GenerationMode; title: string; sub: string; prio: string[] }[] = [
  {
    id: 'operativa',
    title: 'Modalità Operativa',
    sub: 'Punta al 100% di copertura. Quando serve genera deroghe controllate (tracciate).',
    prio: ['1. 11 ore (non derogabili)', '2. Recupero post-notte', '3. Copertura', '4. Equità', '5. Preferenze'],
  },
  {
    id: 'rigida',
    title: 'Modalità Rigida',
    sub: 'Privilegia equità e preferenze. La copertura può scendere; nessuna deroga a notti/weekend/festivi.',
    prio: ['1. 11 ore (non derogabili)', '2. Recupero post-notte', '3. Equità', '4. Preferenze', '5. Copertura'],
  },
];

const AI_MODES: { id: PlanMode; title: string; sub: string }[] = [
  { id: 'coordinatore', title: 'Coordinatore AI', sub: 'Ottimizzatore + equità + desiderata + preferenze attivi. L\u2019AI bilancia il piano come un coordinatore.' },
  { id: 'equa', title: 'Equa', sub: 'Ottimizzatore ed equità attivi (notti/weekend/festivi/ore bilanciati).' },
  { id: 'rapida', title: 'Rapida', sub: 'Solo matrice + copertura. Massima aderenza alla matrice, nessuna ottimizzazione.' },
];

export default function ImpostazioniScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { mode, setMode, aiMode, setAiMode, matriceMese, setMatriceMese, matriciCustom, month, year } = useStore();
  const mKey = monthKey(year, month);
  const meseSel = matriceMese[mKey] || '';
  const catalogo = [...MATRICI, ...matriciCustom];

  const pick = (m: GenerationMode) => {
    if (m === mode) return;
    setMode(m);
    toast.show(`Modalità ${m === 'rigida' ? 'Rigida' : 'Operativa'} attivata. Piano rigenerato.`, 'success');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingBottom: insets.bottom }]}>
      <SheetHeader title="Impostazioni" subtitle="Modalità di generazione del motore" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <SectionTitle>Modalità di pianificazione</SectionTitle>
        {AI_MODES.map((m) => (
          <OptionCard key={m.id} selected={aiMode === m.id} onPress={() => { if (m.id !== aiMode) { setAiMode(m.id); toast.show(`Modalità ${m.title} attivata. Piano rigenerato.`, 'success'); } }}>
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={[styles.title, { color: colors.text }]}>{m.title}</Text>
                {aiMode === m.id ? <Text style={[styles.badge, { color: colors.green, backgroundColor: colors.greenSoft }]}>ATTIVA</Text> : null}
              </View>
              <Text style={[styles.sub, { color: colors.text2 }]}>{m.sub}</Text>
            </View>
          </OptionCard>
        ))}
        <SectionTitle>Modalità motore</SectionTitle>
        {MODES.map((m) => (
          <OptionCard key={m.id} selected={mode === m.id} onPress={() => pick(m.id)}>
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={[styles.title, { color: colors.text }]}>{m.title}</Text>
                {mode === m.id ? <Text style={[styles.badge, { color: colors.blue, backgroundColor: colors.blueSoft }]}>ATTIVA</Text> : null}
              </View>
              <Text style={[styles.sub, { color: colors.text2 }]}>{m.sub}</Text>
              {m.prio.map((p) => (
                <Text key={p} style={[styles.prio, { color: colors.text3 }]}>{p}</Text>
              ))}
            </View>
          </OptionCard>
        ))}
        <Card>
          <Text style={[styles.note, { color: colors.text2 }]}>
            La scelta è salvata in modo persistente e si applica a tutte le generazioni. Le 11 ore, il recupero
            post-notte, il limite di 6 giorni consecutivi e le esenzioni di ruolo del coordinatore restano vincoli
            non derogabili in entrambe le modalità.
          </Text>
        </Card>

        <SectionTitle>Matrice del mese — {MONTHS[month]} {year}</SectionTitle>
        <Text style={[styles.note, { color: colors.text3, marginBottom: 8, paddingHorizontal: 2 }]}>
          Gerarchia: matrice dell&apos;operatore → del reparto → del mese. La matrice mensile è usata solo dagli operatori
          (e reparti) senza matrice propria.
        </Text>
        <OptionCard selected={meseSel === ''} onPress={() => { setMatriceMese(''); toast.show('Matrice mensile rimossa. Piano rigenerato.', 'success'); }}>
          <View style={styles.row}>
            <Text style={[styles.title, { color: colors.text }]}>Nessuna (eredità operatore/reparto)</Text>
            {meseSel === '' ? <Text style={[styles.badge, { color: colors.blue, backgroundColor: colors.blueSoft }]}>ATTIVA</Text> : null}
          </View>
        </OptionCard>
        {catalogo.map((m) => (
          <OptionCard key={m.id} selected={meseSel === m.id} onPress={() => { setMatriceMese(m.id); toast.show(`Matrice mensile: ${m.label}. Piano rigenerato.`, 'success'); }}>
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={[styles.title, { color: colors.text }]}>{m.label}</Text>
                {meseSel === m.id ? <Text style={[styles.badge, { color: colors.blue, backgroundColor: colors.blueSoft }]}>ATTIVA</Text> : <Text style={[styles.badge, { color: colors.text2, backgroundColor: colors.card2 }]}>{m.seq.join(' ')}</Text>}
              </View>
              {m.descrizione ? <Text style={[styles.sub, { color: colors.text2 }]}>{m.descrizione}</Text> : null}
            </View>
          </OptionCard>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '800' },
  badge: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  sub: { fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  prio: { fontSize: 11.5, marginTop: 3 },
  note: { fontSize: 12.5, lineHeight: 18 },
});
