// screens/StrumentiScreen.tsx — strumenti enterprise: Controlla Piano, Undo/Redo, Backup, Audit log

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { shareOrDownloadText } from '../utils/platformShare';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { checkPiano, PianoCheck } from '../services/validator';
import { AuditEntry } from '../types';
import SheetHeader from '../components/SheetHeader';
import Card from '../components/Card';
import SectionTitle from '../components/SectionTitle';
import Button from '../components/Button';
import SelectChip from '../components/SelectChip';

const ENTITIES = ['tutti', 'turno', 'assenza', 'personale', 'reparto', 'mese', 'backup', 'stato'];
const OP_LABEL: Record<string, string> = {
  create: 'Creazione', update: 'Modifica', delete: 'Eliminazione', regen: 'Rigenerazione',
  undo: 'Annulla', redo: 'Ripristina', import: 'Import backup',
};

function fmt(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function StrumentiScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { ctx, currentPiano, audit, canUndo, canRedo, undo, redo, exportBackup, importBackup, prevPiano } = useStore();

  const [check, setCheck] = useState<PianoCheck | null>(null);
  const [filter, setFilter] = useState('tutti');
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const [sel, setSel] = useState({ reparti: true, staff: true, ferie: true, pianos: true });

  const runCheck = () => {
    setCheck(checkPiano(ctx, currentPiano, prevPiano));
  };
  const doExport = () => {
    const t = exportBackup();
    setExportText(t);
    toast.show('Backup generato', 'success');
  };
  const doShare = async () => {
    const t = exportText || exportBackup();
    setExportText(t);
    await shareOrDownloadText(`turnover-backup-${new Date().toISOString().slice(0, 10)}.json`, t);
  };
  const doImport = () => {
    if (!importText.trim()) { toast.show('Incolla prima un backup', 'warning'); return; }
    const r = importBackup(importText, sel);
    toast.show(r.ok ? 'Backup importato e applicato' : `Import fallito: ${r.error}`, r.ok ? 'success' : 'error');
    if (r.ok) setImportText('');
  };
  const toggle = (k: keyof typeof sel) => setSel((s) => ({ ...s, [k]: !s[k] }));

  const scoreColor = check ? (check.score >= 80 ? colors.green : check.score >= 60 ? colors.yellow : colors.red) : colors.text2;
  const filtered: AuditEntry[] = (filter === 'tutti' ? audit : audit.filter((e) => e.entity === filter)).slice(0, 120);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingBottom: insets.bottom }]}>
      <SheetHeader title="Strumenti" subtitle="Validazione · cronologia · backup" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>

        <SectionTitle>Configurazione</SectionTitle>
        <Card>
          <Button title="Modalità motore" variant="secondary" full onPress={() => router.push('/impostazioni')} />
          <Button title="Catalogo matrici" variant="secondary" full onPress={() => router.push('/matrici')} style={{ marginTop: 10 }} />
          <Button title="Desiderata operatori" variant="secondary" full onPress={() => router.push('/desiderata')} style={{ marginTop: 10 }} />
          <Text style={[styles.hint, { color: colors.text3 }]}>Scegli la modalità di generazione (Rigida/Operativa) e gestisci i desiderata del personale. Entrambe rigenerano il piano del mese.</Text>
        </Card>

        <SectionTitle>Controlla Piano</SectionTitle>
        <Card>
          <Button title="Analizza il piano del mese" variant="primary" full onPress={runCheck} />
          {check ? (
            <>
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreLab, { color: colors.text2 }]}>Punteggio piano</Text>
                <Text style={[styles.scoreVal, { color: scoreColor }]}>{check.score}/100</Text>
              </View>
              <Text style={[styles.meta, { color: colors.text2 }]}>
                Copertura {check.coveragePct}% · equità {check.equityIndex}/100 · violazioni riposo {check.restViolations}
              </Text>
              {check.errors.map((e, i) => (
                <View key={'e' + i} style={[styles.issue, { backgroundColor: colors.redSoft }]}>
                  <Text style={[styles.issueTxt, { color: colors.red }]}>⛔ {e.message}</Text>
                </View>
              ))}
              {check.warnings.map((w, i) => (
                <View key={'w' + i} style={[styles.issue, { backgroundColor: colors.yellowSoft }]}>
                  <Text style={[styles.issueTxt, { color: colors.yellow }]}>⚠ {w.message}</Text>
                </View>
              ))}
              {check.suggestions.map((s, i) => (
                <View key={'s' + i} style={[styles.issue, { backgroundColor: colors.blueSoft }]}>
                  <Text style={[styles.issueTxt, { color: colors.blue }]}>💡 {s.message}</Text>
                </View>
              ))}
              {!check.errors.length && !check.warnings.length ? (
                <Text style={[styles.ok, { color: colors.green }]}>Nessun problema rilevato.</Text>
              ) : null}
            </>
          ) : (
            <Text style={[styles.hint, { color: colors.text3 }]}>Verifica copertura, riposi 11h, notti/weekend/festivi, equità e integrità con punteggio 0–100.</Text>
          )}
        </Card>

        <SectionTitle>Cronologia (Undo / Redo)</SectionTitle>
        <Card>
          <View style={styles.dual}>
            <Button title="Annulla" variant="secondary" disabled={!canUndo} onPress={() => { undo(); toast.show('Modifica annullata', 'info'); }} style={{ flex: 1 }} />
            <Button title="Ripristina" variant="secondary" disabled={!canRedo} onPress={() => { redo(); toast.show('Modifica ripristinata', 'info'); }} style={{ flex: 1 }} />
          </View>
          <Text style={[styles.hint, { color: colors.text3 }]}>Le modifiche a turni, assenze, personale e reparti sono reversibili (snapshot automatici, storico persistente).</Text>
        </Card>

        <SectionTitle>Backup</SectionTitle>
        <Card>
          <View style={styles.dual}>
            <Button title="Genera" variant="soft" onPress={doExport} style={{ flex: 1 }} />
            <Button title="Condividi" variant="secondary" onPress={doShare} style={{ flex: 1 }} />
          </View>
          {exportText ? (
            <TextInput
              value={exportText}
              editable={false}
              multiline
              style={[styles.code, { color: colors.text2, backgroundColor: colors.bg, borderColor: colors.line }]}
            />
          ) : null}
          <Text style={[styles.label, { color: colors.text2 }]}>Importa (incolla un backup)</Text>
          <TextInput
            value={importText}
            onChangeText={setImportText}
            placeholder='{"app":"TURNOVER",...}'
            placeholderTextColor={colors.text3}
            multiline
            style={[styles.code, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.line }]}
          />
          <Text style={[styles.label, { color: colors.text2 }]}>Ripristino selettivo</Text>
          <View style={styles.chips}>
            <SelectChip label="Reparti" selected={sel.reparti} onPress={() => toggle('reparti')} />
            <SelectChip label="Personale" selected={sel.staff} onPress={() => toggle('staff')} />
            <SelectChip label="Assenze" selected={sel.ferie} onPress={() => toggle('ferie')} />
            <SelectChip label="Piani" selected={sel.pianos} onPress={() => toggle('pianos')} />
          </View>
          <Button title="Importa backup" variant="primary" full onPress={doImport} style={{ marginTop: 10 }} />
          <Text style={[styles.hint, { color: colors.text3 }]}>Formato JSON leggibile con checksum di integrità; l'import è reversibile con Annulla.</Text>
        </Card>

        <SectionTitle>Audit log</SectionTitle>
        <Card>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {ENTITIES.map((e) => (
              <SelectChip key={e} label={e} selected={filter === e} onPress={() => setFilter(e)} />
            ))}
          </ScrollView>
          {filtered.length ? filtered.map((e) => (
            <View key={e.id} style={[styles.logRow, { borderBottomColor: colors.separator }]}>
              <Text style={[styles.logTime, { color: colors.text3 }]}>{fmt(e.ts)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.logOp, { color: colors.text }]}>{OP_LABEL[e.op] || e.op} · {e.entity}</Text>
                {e.before || e.after ? (
                  <Text style={[styles.logDelta, { color: colors.text2 }]} numberOfLines={2}>
                    {e.before ? e.before : '∅'} → {e.after ? e.after : '∅'}
                  </Text>
                ) : null}
              </View>
            </View>
          )) : <Text style={[styles.hint, { color: colors.text3 }]}>Nessuna voce per questo filtro.</Text>}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16, paddingBottom: 40 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  scoreLab: { fontSize: 13 },
  scoreVal: { fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  meta: { fontSize: 12, marginTop: 4, marginBottom: 4 },
  issue: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 8 },
  issueTxt: { fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  ok: { fontSize: 13, fontWeight: '700', marginTop: 10 },
  hint: { fontSize: 12.5, marginTop: 10, lineHeight: 18 },
  dual: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  code: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, fontSize: 11, minHeight: 70, maxHeight: 160, marginTop: 10, fontFamily: 'Courier' },
  logRow: { flexDirection: 'row', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  logTime: { fontSize: 11, width: 64, paddingTop: 1 },
  logOp: { fontSize: 13, fontWeight: '700' },
  logDelta: { fontSize: 12, marginTop: 1 },
});
