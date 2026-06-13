// screens/ImportPersonaleScreen.tsx — Import massivo personale (P1).
// La selezione diretta del file .xlsx richiede expo-document-picker (non presente in questo ambiente):
// qui l'import è usabile incollando i dati (o usando il template), con validazione/anteprima/errori/conferma.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import SectionTitle from '../components/SectionTitle';
import { Staff } from '../types';
import { parseStaffRows, staffImportTemplateRows, STAFF_IMPORT_COLUMNS, StaffImportResult } from '../utils/staffImport';
import { shareOrDownloadText } from '../utils/platformShare';

function draftToStaff(d: any, i: number): Staff {
  return {
    id: `inf_${Date.now()}_${i}`,
    nome: d.cognome ? `${d.nome} ${d.cognome}` : d.nome,
    qualifica: d.qualifica,
    contratto: d.contratto,
    nottiPerCiclo: 2,
    matrice: 'M62',
    offset: 0,
    reparti: d.reparti || [],
    esenzioniTurni: d.esenzioniTurni || [],
    esenzioniSettori: [],
    ...(d.oreSettimanali ? { oreSettimanali: d.oreSettimanali } : {}),
    ...(d.esenteWeekend ? { esenteWeekend: true } : {}),
    ...(d.esenteFestivi ? { esenteFestivi: true } : {}),
  } as Staff;
}

export default function ImportPersonaleScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { ctx, addStaff } = useStore();

  const [raw, setRaw] = useState('');
  const [result, setResult] = useState<StaffImportResult | null>(null);
  const reparti = useMemo(() => ctx.reparti.map((r) => ({ id: r.id, nome: r.nome })), [ctx.reparti]);

  const downloadTemplate = async () => {
    try { await shareOrDownloadText('template-personale.csv', staffImportTemplateRows().map((r) => r.join(';')).join('\n'), 'text/csv'); toast.show('Template esportato', 'success'); }
    catch { toast.show('Export non riuscito', 'error'); }
  };

  const analyze = () => {
    const lines = raw.trim().split('\n').filter((l) => l.trim());
    if (!lines.length) { toast.show('Incolla i dati o usa il template', 'error'); return; }
    const sep = lines[0].includes('\t') ? '\t' : ';';
    const hasHeader = lines[0].toLowerCase().includes('nome') && lines[0].toLowerCase().includes('ruolo');
    const cols = hasHeader ? lines[0].split(sep).map((c) => c.trim().toLowerCase()) : [...STAFF_IMPORT_COLUMNS];
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const rows = dataLines.map((l) => { const parts = l.split(sep); const o: Record<string, string> = {}; cols.forEach((c, i) => (o[c] = (parts[i] || '').trim())); return o; });
    setResult(parseStaffRows(rows, reparti, ctx.staff.map((s) => ({ nome: s.nome }))));
  };

  const confirm = () => {
    if (!result || !result.valid.length) return;
    try {
      result.valid.forEach((d, i) => addStaff(draftToStaff(d, i)));
      toast.show(`${result.valid.length} operatori importati`, 'success');
      setRaw(''); setResult(null);
      router.back();
    } catch { toast.show('Import non riuscito: nessun dato modificato', 'error'); }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Import personale" subtitle="Da Excel/CSV (incolla i dati)" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <GlassCard style={{ marginBottom: 12 }}>
          <Text style={[styles.note, { color: colors.text2 }]}>Colonne: {STAFF_IMPORT_COLUMNS.join(', ')}.</Text>
          <Text style={[styles.note, { color: colors.text3, marginTop: 6 }]}>La selezione diretta del file .xlsx sarà disponibile con il modulo file. Per ora scarica il template, compilalo e incolla qui le righe (separate da «;» o tab).</Text>
          <Button title="Scarica template" small variant="secondary" icon="download-outline" onPress={downloadTemplate} style={{ marginTop: 10 }} />
        </GlassCard>

        <SectionTitle>Incolla i dati</SectionTitle>
        <TextInput
          style={[styles.area, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.card2 }]}
          placeholder={'Mario;Rossi;12345;Infermiere;FT36;36;Medicina;weekend;notti'}
          placeholderTextColor={colors.text3} multiline value={raw} onChangeText={setRaw}
        />
        <Button title="Analizza" full icon="search-outline" onPress={analyze} style={{ marginTop: 10 }} />

        {result ? (
          <>
            <SectionTitle>Anteprima</SectionTitle>
            <GlassCard>
              <Text style={[styles.sum, { color: colors.green }]}>✓ {result.valid.length} validi</Text>
              {result.errors.length ? <Text style={[styles.sum, { color: colors.red }]}>✗ {result.errors.length} errori</Text> : null}
              {result.duplicates.length ? <Text style={[styles.sum, { color: colors.yellow }]}>⚠ {result.duplicates.length} duplicati</Text> : null}
            </GlassCard>
            {result.valid.slice(0, 30).map((d, i) => (
              <GlassCard key={i} style={styles.prev}><Text style={[styles.pNome, { color: colors.text }]}>{d.cognome ? `${d.nome} ${d.cognome}` : d.nome}</Text><Text style={[styles.pMeta, { color: colors.text3 }]}>{d.qualifica} · {d.contratto}{d.reparti.length ? ` · ${d.reparti.length} reparto/i` : ''}</Text></GlassCard>
            ))}
            {result.errors.slice(0, 20).map((e, i) => <Text key={`e${i}`} style={[styles.err, { color: colors.red }]}>Riga {e.row} · {e.field}: {e.message}</Text>)}
            {result.duplicates.slice(0, 20).map((e, i) => <Text key={`d${i}`} style={[styles.err, { color: colors.yellow }]}>Riga {e.row}: {e.reason}</Text>)}
            {result.valid.length ? <Button title={`Importa ${result.valid.length} operatori`} full icon="checkmark-outline" onPress={confirm} style={{ marginTop: 14 }} /> : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  note: { fontSize: 12, lineHeight: 18 },
  area: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 13, minHeight: 120, textAlignVertical: 'top' },
  sum: { fontSize: 13, fontWeight: '700', marginVertical: 1 },
  prev: { paddingVertical: 10, marginBottom: 8 },
  pNome: { fontSize: 15, fontWeight: '700' },
  pMeta: { fontSize: 12, marginTop: 2 },
  err: { fontSize: 12, marginTop: 4 },
});
