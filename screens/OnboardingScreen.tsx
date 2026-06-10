// screens/OnboardingScreen.tsx — Wizard primo avvio (BUG 5): step con stato e blocco progressivo.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import PressableScale from '../components/PressableScale';
import Icon from '../components/Icon';
import { markOnboardingDone } from '../services/onboardingFlag';

export default function OnboardingScreen({ onDone }: { onDone?: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { ctx, currentPiano } = useStore();

  const done = [
    ctx.reparti.length > 0,
    ctx.staff.length > 0,
    ctx.reparti.some((r) => !!r.matrice),
    Object.keys(currentPiano || {}).length > 0,
  ];
  const allDone = done.every(Boolean);

  const STEPS = [
    { title: 'Crea il reparto', desc: 'Nome, orari dei turni e copertura minima.', icon: 'business-outline', go: '/reparto-wizard', cta: 'Crea reparto' },
    { title: 'Importa il personale', desc: 'Aggiungilo manualmente o tramite import.', icon: 'people-outline', go: '/import-personale', cta: 'Aggiungi personale' },
    { title: 'Configura la matrice', desc: 'Scegli il ciclo di turni del reparto.', icon: 'grid-outline', go: '/matrici', cta: 'Configura matrice' },
    { title: 'Genera il primo mese', desc: 'Turni conformi in pochi secondi.', icon: 'sparkles-outline', go: '/', cta: 'Genera turni' },
  ];

  const enter = () => { void markOnboardingDone(); if (onDone) onDone(); else router.back(); };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: onDone ? insets.top : 0 }]}>
      {onDone ? (
        <View style={styles.headStandalone}>
          <Text style={[styles.bigTitle, { color: colors.text }]}>Configura il reparto</Text>
          <Text style={[styles.bigSub, { color: colors.text2 }]}>Completa questi passaggi una sola volta per iniziare a generare i turni.</Text>
        </View>
      ) : (
        <SheetHeader title="Configura il reparto" subtitle="Completa una sola volta per iniziare" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {STEPS.map((s, i) => {
          const isDone = done[i];
          const locked = i > 0 && !done[i - 1];
          const stateLabel = isDone ? 'Completato' : locked ? 'Bloccato' : 'Da completare';
          const stateColor = isDone ? colors.green : locked ? colors.text3 : colors.blue;
          return (
            <GlassCard key={i} style={[styles.step, locked && { opacity: 0.55 }]}>
              <View style={[styles.num, { backgroundColor: isDone ? colors.green : locked ? colors.card2 : colors.blueSoft }]}>
                {isDone ? <Icon name="checkmark" size={18} color="#fff" /> : locked ? <Text style={[styles.numTxt, { color: colors.text3 }]}>🔒</Text> : <Text style={[styles.numTxt, { color: colors.blue }]}>{i + 1}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: colors.text }]}>{s.title}</Text>
                  <Text style={[styles.state, { color: stateColor }]}>{isDone ? '✓ ' : '○ '}{stateLabel}</Text>
                </View>
                <Text style={[styles.desc, { color: colors.text3 }]}>{s.desc}</Text>
                {!locked ? (
                  <PressableScale onPress={() => router.push(s.go as any)} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                    <View style={[styles.ctaBtn, { backgroundColor: isDone ? colors.card2 : colors.blue }]}>
                      <Icon name={s.icon as any} size={15} color={isDone ? colors.text2 : '#fff'} />
                      <Text style={{ color: isDone ? colors.text2 : '#fff', fontWeight: '700', fontSize: 13 }}>{isDone ? 'Rivedi' : s.cta}</Text>
                    </View>
                  </PressableScale>
                ) : null}
              </View>
            </GlassCard>
          );
        })}

        {allDone ? (
          <Button title="Entra nella Dashboard" full icon="sparkles-outline" onPress={enter} style={{ marginTop: 8 }} />
        ) : (
          <Text style={[styles.hint, { color: colors.text3 }]}>Completa lo step attivo per sbloccare il successivo.</Text>
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  headStandalone: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  bigTitle: { fontSize: 30, fontWeight: '800' },
  bigSub: { fontSize: 14.5, marginTop: 6, lineHeight: 20 },
  step: { flexDirection: 'row', gap: 14, marginBottom: 12, alignItems: 'flex-start' },
  num: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  numTxt: { fontSize: 15, fontWeight: '800' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', flex: 1 },
  state: { fontSize: 11.5, fontWeight: '700' },
  desc: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 44, borderRadius: 12 },
  hint: { fontSize: 12.5, textAlign: 'center', marginTop: 10 },
});
