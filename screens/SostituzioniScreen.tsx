// screens/SostituzioniScreen.tsx — proposta automatica sostituti per slot scoperti

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { rankSubstitutes, findUncovered } from '../services/substitution';
import { TURNI } from '../utils/constants';
import { getRep } from '../utils/helpers';
import { TurnoLavoro } from '../types';
import SheetHeader from '../components/SheetHeader';
import Card from '../components/Card';
import Button from '../components/Button';

interface Target { turno: TurnoLavoro; settore: string; }

export default function SostituzioniScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ day?: string; repId?: string; excludeId?: string; turno?: string; settore?: string }>();
  const { ctx, currentPiano, reparti, setCell, logEvent } = useStore();

  const day = parseInt(String(params.day || '1'), 10) || 1;
  const repId = String(params.repId || (reparti[0] ? reparti[0].id : ''));
  const excludeId = params.excludeId ? String(params.excludeId) : undefined;
  const rep = getRep(reparti, repId);

  const targets: Target[] = useMemo(() => {
    if (params.turno && params.settore) return [{ turno: params.turno as TurnoLavoro, settore: String(params.settore) }];
    return findUncovered(ctx, currentPiano, day, repId).map((u) => ({ turno: u.turn, settore: u.code }));
  }, [ctx, currentPiano, day, repId, params.turno, params.settore]);

  const ranks = useMemo(() => targets.map((t) => ({
    target: t,
    candidates: rankSubstitutes(ctx, currentPiano, { day, repId, turno: t.turno, settore: t.settore, excludeId }),
  })), [targets, ctx, currentPiano, day, repId, excludeId]);

  const assign = (t: Target, infId: string, nome: string) => {
    setCell(infId, day, t.turno, repId, t.settore);
    logEvent('sostituzione', 'turno', `${rep ? rep.nome : repId} ${t.settore} g${day}`, `${nome} assegnato`);
    toast.show(`${nome} assegnato a ${t.settore}`, 'success');
  };

  const autoAll = () => {
    let n = 0;
    for (const r of ranks) {
      const best = r.candidates.find((c) => c.eligible);
      if (best) { assign(r.target, best.infId, best.nome); n++; }
    }
    toast.show(n ? `${n} sostituzioni assegnate automaticamente` : 'Nessun sostituto idoneo disponibile', n ? 'success' : 'warning');
  };

  const reject = () => {
    logEvent('rifiuto', 'sostituzione', `${rep ? rep.nome : repId} g${day}`, null);
    toast.show('Proposta rifiutata', 'info');
    router.back();
  };

  const scoreColor = (s: number) => (s >= 85 ? colors.green : s >= 70 ? colors.yellow : colors.red);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingBottom: insets.bottom }]}>
      <SheetHeader title="Sostituzioni" subtitle={`${rep ? rep.nome : ''} · giorno ${day}`} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        {targets.length === 0 ? (
          <Card>
            <Text style={[styles.empty, { color: colors.green }]}>Nessuno slot scoperto da coprire in questo reparto.</Text>
          </Card>
        ) : (
          <>
            <Button title="Assegna automaticamente i migliori" variant="primary" full onPress={autoAll} style={{ marginBottom: 14 }} />
            {ranks.map((r, i) => {
              const eligibles = r.candidates.filter((c) => c.eligible).slice(0, 5);
              const scartati = r.candidates.filter((c) => !c.eligible).length;
              return (
                <Card key={i} style={{ marginBottom: 12 }}>
                  <Text style={[styles.tHead, { color: colors.text }]}>
                    {TURNI[r.target.turno]?.label || r.target.turno} · {r.target.settore}
                  </Text>
                  {eligibles.length === 0 ? (
                    <Text style={[styles.none, { color: colors.text3 }]}>Nessun sostituto idoneo (riposo 11h / disponibilità / compatibilità).</Text>
                  ) : eligibles.map((c, j) => (
                    <View key={c.infId} style={[styles.cand, { borderTopColor: colors.separator, borderTopWidth: j === 0 ? 0 : StyleSheet.hairlineWidth }]}>
                      <View style={styles.candTop}>
                        <Text style={[styles.rank, { color: colors.text2 }]}>{j + 1}°</Text>
                        <Text style={[styles.cName, { color: colors.text }]} numberOfLines={1}>{c.nome}</Text>
                        <View style={[styles.badge, { backgroundColor: scoreColor(c.score) }]}>
                          <Text style={styles.badgeTxt}>{c.score}%</Text>
                        </View>
                      </View>
                      <Text style={[styles.motivo, { color: colors.text3 }]}>{c.motivo}</Text>
                      <Button title="Assegna" variant="soft" small onPress={() => assign(r.target, c.infId, c.nome)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
                    </View>
                  ))}
                  {scartati > 0 ? <Text style={[styles.scartati, { color: colors.text3 }]}>{scartati} operatori non proponibili (occupati, assenti o non compatibili).</Text> : null}
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
      <View style={[styles.foot, { borderTopColor: colors.separator }]}>
        <Button title="Rifiuta proposta" variant="secondary" onPress={reject} style={{ flex: 1 }} />
        <Button title="Chiudi" variant="primary" onPress={() => router.back()} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16, paddingBottom: 30 },
  empty: { fontSize: 14, fontWeight: '700', textAlign: 'center', paddingVertical: 6 },
  tHead: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  none: { fontSize: 12.5, lineHeight: 18 },
  cand: { paddingVertical: 9 },
  candTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rank: { fontSize: 13, fontWeight: '800', width: 24 },
  cName: { flex: 1, fontSize: 14.5, fontWeight: '700' },
  badge: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTxt: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  motivo: { fontSize: 12, marginTop: 3, marginLeft: 32, lineHeight: 16 },
  scartati: { fontSize: 11.5, marginTop: 8, fontStyle: 'italic' },
  foot: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
