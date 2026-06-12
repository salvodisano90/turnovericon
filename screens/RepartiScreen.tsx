// screens/RepartiScreen.tsx

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '../utils/confirm';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { TURNI, MATRICI } from '../utils/constants';
import { avatarColor, getMx, secCode } from '../utils/helpers';
import { getActiveMatrice, repartoMatriceMode, nextMatriceChange } from '../services/matriceResolver';
import { computeCoverage } from '../services/engine';
import { showContextMenu } from '../utils/contextMenu';
import { Turno } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import Card from '../components/Card';
import Button from '../components/Button';

export default function RepartiScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { reparti, removeReparto, matriciCustom, ctx, currentPiano } = useStore();
  const allMat = [...MATRICI, ...matriciCustom];
  const coverage = useMemo(() => { try { return computeCoverage(ctx, currentPiano || {}); } catch { return null; } }, [ctx, currentPiano]);
  const repPct = (id: string): number | null => {
    const rc = coverage && coverage.byRep && coverage.byRep[id];
    if (!rc || !rc.slots || !rc.slots.length) return null;
    const tot = rc.slots.reduce((a, sl) => a + (sl.total || 0), 0);
    const cov = rc.slots.reduce((a, sl) => a + (sl.covered || 0), 0);
    return tot ? Math.round((cov / tot) * 100) : null;
  };
  const MM = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];

  const confirmRemove = (id: string, nome: string) => {
    confirmAction('Rimuovere reparto', `Eliminare il reparto ${nome}?`, () => {
      removeReparto(id);
      toast.show(`Reparto ${nome} rimosso`, 'success');
    }, 'Rimuovi');
  };

  const pill = (
    <View style={[styles.pill, { backgroundColor: colors.blueSoft }]}>
      <Text style={[styles.pillTxt, { color: colors.blue }]}>{reparti.length} reparti</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Reparti" actionIcon="add" onAction={() => router.push('/reparto-wizard')} pill={pill} />
      <ScrollView contentContainerStyle={styles.content}>
        {!reparti.length ? (
          <EmptyState
            icon="business-outline"
            title="Nessun reparto"
            desc="Crea il primo reparto con settori, orari e matrice di copertura."
            actionLabel="Crea reparto"
            onAction={() => router.push('/reparto-wizard')}
          />
        ) : (
          reparti.map((r, i) => {
            const mx = getMx(r.matrice);
            const tags: { code: string; turn: Turno }[] = [];
            (['M', 'P', 'N'] as Turno[]).forEach((t) => {
              for (let sn = 1; sn <= (r.settori[t as 'M' | 'P' | 'N'] || 0); sn++) tags.push({ code: secCode(t, r.sigla, sn), turn: t });
            });
            return (
              <Card key={r.id}>
                <View style={styles.head}>
                  <View style={[styles.icon, { backgroundColor: avatarColor(i) }]}>
                    <Text style={styles.iconTxt}>{r.sigla}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.text }]}>{r.nome}</Text>
                    <Text style={[styles.sub, { color: colors.text2 }]}>Sigla {r.sigla} · {mx ? mx.label : '–'}</Text>
                  </View>
                </View>
                <View style={styles.statsRow}>
                  {(['M', 'P', 'N'] as ('M' | 'P' | 'N')[]).map((t) => (
                    <Text key={t} style={[styles.stat, { color: colors.text2 }]}>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{t}×{r.settori[t]}</Text> {r.orari[t].s}–{r.orari[t].e}
                    </Text>
                  ))}
                </View>
                {(() => {
                  const mode = repartoMatriceMode(r);
                  const today = new Date();
                  const active = getActiveMatrice(r, allMat, today.getMonth(), today.getDate());
                  const modeLabel = mode === 'standard' ? 'Standard' : mode === 'custom' ? 'Personalizzata' : 'Stagionale';
                  const change = mode === 'seasonal' ? nextMatriceChange(r, today.getMonth(), today.getDate()) : null;
                  return (
                    <View style={[styles.matBox, { borderColor: colors.line, backgroundColor: colors.card2 }]}>
                      <View style={styles.matRow}><Text style={[styles.matK, { color: colors.text3 }]}>Modalità</Text><Text style={[styles.matV, { color: colors.text }]}>{modeLabel}</Text></View>
                      <View style={styles.matRow}><Text style={[styles.matK, { color: colors.text3 }]}>Matrice attiva</Text><Text style={[styles.matV, { color: colors.blue }]} numberOfLines={1}>{active ? active.label : '—'}</Text></View>
                      {(() => { const pc = repPct(r.id); return pc === null ? null : (
                        <View style={styles.matRow}><Text style={[styles.matK, { color: colors.text3 }]}>Copertura</Text><Text style={[styles.matV, { color: pc >= 90 ? colors.green : pc >= 70 ? colors.yellow : colors.red }]}>{pc}%</Text></View>
                      ); })()}
                      {mode === 'seasonal' && change ? (
                        <>
                          <View style={styles.matRow}><Text style={[styles.matK, { color: colors.text3 }]}>Prossimo cambio</Text><Text style={[styles.matV, { color: colors.text }]}>{change.day} {MM[change.month0]}</Text></View>
                          <View style={styles.matRow}><Text style={[styles.matK, { color: colors.text3 }]}>Nuova matrice</Text><Text style={[styles.matV, { color: colors.text }]} numberOfLines={1}>{(allMat.find((m) => m.id === change.matriceId)?.label) || '—'}</Text></View>
                        </>
                      ) : null}
                    </View>
                  );
                })()}
                <View style={styles.tags}>
                  {tags.map((tg) => (
                    <Text key={tg.code} style={[styles.tag, { color: TURNI[tg.turn].col, backgroundColor: colors.shift[tg.turn].bg }]}>{tg.code}</Text>
                  ))}
                </View>
                <Button
                  title="Gestisci"
                  variant="secondary"
                  small
                  full
                  icon={<Icon name="ellipsis-horizontal" size={16} color={colors.text} />}
                  onPress={() => showContextMenu(r.nome, [
                    { label: 'Modifica reparto', onPress: () => router.push({ pathname: '/reparto-wizard', params: { id: r.id } }) },
                    { label: 'Rimuovi reparto', destructive: true, onPress: () => confirmRemove(r.id, r.nome) },
                  ])}
                />
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  matBox: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10, gap: 6 },
  matRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  matK: { fontSize: 12.5, fontWeight: '600' },
  matV: { flex: 1, fontSize: 13.5, fontWeight: '800', textAlign: 'right' },
  safe: { flex: 1 },
  content: { padding: 12, paddingBottom: 28 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillTxt: { fontSize: 13, fontWeight: '700' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  stat: { fontSize: 11.5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 12 },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, overflow: 'hidden' },
});
