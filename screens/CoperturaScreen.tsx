// screens/CoperturaScreen.tsx

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { TURNI } from '../utils/constants';
import { avatarColor } from '../utils/helpers';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import Card from '../components/Card';
import CoverageBar from '../components/CoverageBar';

export default function CoperturaScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { reparti, coverage, regenerate } = useStore();

  const runAI = () => {
    const { stats, coverage: cov } = regenerate();
    toast.show(`AI: copertura ${cov.globalPct}% · ${stats.filled} assegnati`, cov.uncovered.length ? 'warning' : 'success');
  };

  const pill = (
    <View style={[styles.pill, { backgroundColor: colors.blueSoft }]}>
      <Text style={[styles.pillTxt, { color: colors.blue }]}>{coverage.globalPct}% medio</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Copertura" actionIcon="sparkles" onAction={runAI} pill={pill} />
      <ScrollView contentContainerStyle={styles.content}>
        {!reparti.length ? (
          <EmptyState
            icon="pulse-outline"
            title="Nessun dato di copertura"
            desc="Crea reparti e aggiungi personale per vedere la copertura dei turni."
            actionLabel="Crea reparto"
            onAction={() => router.push('/reparto-wizard')}
          />
        ) : (
          reparti.map((r, i) => {
            const rc = coverage.byRep[r.id] || { slots: [], avg: { M: null, P: null, N: null }, hasProblemi: false };
            return (
              <Card key={r.id}>
                <View style={styles.head}>
                  <View style={[styles.icon, { backgroundColor: avatarColor(i) }]}>
                    <Text style={styles.iconTxt}>{r.sigla}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.text }]}>{r.nome}</Text>
                    <Text style={[styles.sub, { color: colors.text2 }]}>
                      M {rc.avg.M == null ? '–' : rc.avg.M + '%'} · P {rc.avg.P == null ? '–' : rc.avg.P + '%'} · N {rc.avg.N == null ? '–' : rc.avg.N + '%'}
                    </Text>
                  </View>
                </View>
                {rc.slots.map((s) => (
                  <CoverageBar key={s.code} label={s.code} pct={s.pct} labelColor={TURNI[s.turn].col} />
                ))}
                {rc.hasProblemi ? (
                  <Pressable onPress={runAI} style={styles.link}>
                    <Text style={[styles.linkTxt, { color: colors.red }]}>✨ Chiedi all’AI di coprire i turni mancanti</Text>
                  </Pressable>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 12, paddingBottom: 28 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillTxt: { fontSize: 13, fontWeight: '700' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  link: { marginTop: 10 },
  linkTxt: { fontSize: 13, fontWeight: '600' },
});
