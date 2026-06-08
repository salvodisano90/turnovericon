// screens/TurniScreen.tsx

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { TURNI } from '../utils/constants';
import { Turno } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import AIBanner from '../components/AIBanner';
import Chip from '../components/Chip';
import Card from '../components/Card';
import ShiftGrid from '../components/ShiftGrid';

export default function TurniScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { reparti, staff, currentPiano, coverage, filterReparto, setFilter, regenerate, year, month, canUndo, canRedo, undo, redo } = useStore();

  const visible = useMemo(() => {
    if (filterReparto === 'all') return staff;
    return staff.filter((s) => (s.reparti || []).indexOf(filterReparto) >= 0);
  }, [staff, filterReparto]);

  const runAI = () => {
    const { stats, coverage: cov } = regenerate();
    let msg = `AI: copertura ${cov.globalPct}%`;
    if (stats.filled) msg += ` · ${stats.filled} turni assegnati`;
    if (stats.deroghe) msg += ` · ${stats.deroghe} deroghe`;
    if (typeof stats.equityAfter === 'number') msg += ` · equità ${stats.equityAfter}/100`;
    toast.show(msg, cov.uncovered.length ? 'warning' : 'success');
  };

  const pill = (
    <View style={[styles.pill, { backgroundColor: coverage.globalPct >= 90 ? colors.greenSoft : coverage.globalPct >= 70 ? colors.yellowSoft : colors.redSoft }]}>
      <View style={[styles.dot, { backgroundColor: coverage.globalPct >= 90 ? colors.green : coverage.globalPct >= 70 ? colors.yellow : colors.red }]} />
      <Text style={[styles.pillTxt, { color: coverage.globalPct >= 90 ? colors.green : coverage.globalPct >= 70 ? colors.yellow : colors.red }]}>{coverage.globalPct}% coperto</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Turni"
        actionIcon="sparkles"
        onAction={runAI}
        pill={pill}
        extraActions={[
          { icon: 'arrow-undo', onPress: () => { undo(); toast.show('Modifica annullata', 'info'); }, disabled: !canUndo },
          { icon: 'arrow-redo', onPress: () => { redo(); toast.show('Modifica ripristinata', 'info'); }, disabled: !canRedo },
          { icon: 'construct-outline', onPress: () => router.push('/strumenti') },
        ]}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {!reparti.length ? (
          <EmptyState
            icon="business-outline"
            title="Nessun reparto"
            desc="Inizia creando un reparto con i suoi settori e orari. Poi aggiungi il personale e l'AI penserà ai turni."
            actionLabel="Crea reparto"
            onAction={() => router.push('/reparto-wizard')}
          />
        ) : !staff.length ? (
          <EmptyState
            icon="people-outline"
            title="Nessun membro dello staff"
            desc="Aggiungi gli operatori con contratto e matrice. Appena inserisci il personale, l'AI genera e copre i turni automaticamente."
            actionLabel="Aggiungi membro"
            onAction={() => router.push('/staff-wizard')}
          />
        ) : (
          <>
            <AIBanner
              ok={coverage.uncovered.length === 0}
              title={coverage.uncovered.length === 0 ? 'Piano ottimale' : 'Assistente AI'}
              subtitle={coverage.uncovered.length === 0 ? 'Tutti i turni del mese sono coperti' : `${coverage.uncovered.length} turni scoperti · genero il piano ottimale`}
              actionLabel={coverage.uncovered.length === 0 ? 'Rigenera' : 'Genera'}
              onAction={runAI}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="Tutti" active={filterReparto === 'all'} onPress={() => setFilter('all')} />
              {reparti.map((r) => (
                <Chip key={r.id} label={r.nome} active={filterReparto === r.id} onPress={() => setFilter(r.id)} />
              ))}
            </ScrollView>

            <Card noPadding>
              <ShiftGrid
                staff={visible}
                allStaff={staff}
                piano={currentPiano}
                year={year}
                month={month}
                onCellPress={(infId, day) => router.push({ pathname: '/cell-editor', params: { infId, day: String(day) } })}
              />
            </Card>

            <Card>
              <View style={styles.legend}>
                {(['M', 'P', 'N', 'R', 'F'] as Turno[]).map((t) => (
                  <View key={t} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.shift[t].bg }]} />
                    <Text style={[styles.legendTxt, { color: colors.text2 }]}>{TURNI[t].label}</Text>
                  </View>
                ))}
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.blue }]} />
                  <Text style={[styles.legendTxt, { color: colors.text2 }]}>Auto AI</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.red }]} />
                  <Text style={[styles.legendTxt, { color: colors.text2 }]}>Deroga</Text>
                </View>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 12, paddingBottom: 28 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillTxt: { fontSize: 13, fontWeight: '700' },
  chips: { gap: 8, paddingVertical: 2, paddingBottom: 10, paddingRight: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
  legendTxt: { fontSize: 11.5 },
});
