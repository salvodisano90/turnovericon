// components/TimeStepper.tsx — selettore orario iOS-first (RICOSTRUITO).
// Una CARD per orario: valore grande centrale (HH:MM) + pulsanti SOTTO (−1h/+1h, −15m/+15m).
// Nessun controllo affiancato al valore, nessuna width hardcoded, full-width, target ≥56, wrap responsive.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import PressableScale from './PressableScale';

const pad = (n: number) => String(n).padStart(2, '0');

function parse(value: string): { h: number; m: number } {
  const p = (value || '00:00').split(':');
  const h = Math.min(23, Math.max(0, parseInt(p[0], 10) || 0));
  const mRaw = parseInt(p[1], 10) || 0;
  const m = (Math.round(mRaw / 15) * 15) % 60; // step 15 minuti
  return { h, m };
}

function StepButton({ label, onPress, colors }: { label: string; onPress: () => void; colors: any }) {
  return (
    <PressableScale onPress={onPress} style={styles.btnWrap}>
      <View style={[styles.btn, { backgroundColor: colors.blueSoft }]}>
        <Text style={[styles.btnTxt, { color: colors.blue }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

export function TimeStepperField({ value, onChange, label }: { value: string; onChange: (hhmm: string) => void; label?: string }) {
  const { colors } = useTheme();
  const { h, m } = parse(value);
  const emit = (nh: number, nm: number) => onChange(`${pad((nh + 24) % 24)}:${pad((nm + 60) % 60)}`);

  return (
    <View style={styles.block}>
      {label ? <Text style={[styles.lbl, { color: colors.text3 }]}>{label}</Text> : null}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
        <Text style={[styles.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {pad(h)}:{pad(m)}
        </Text>
        <View style={styles.row}>
          <StepButton label="− 1h" onPress={() => emit(h - 1, m)} colors={colors} />
          <StepButton label="+ 1h" onPress={() => emit(h + 1, m)} colors={colors} />
        </View>
        <View style={styles.row}>
          <StepButton label="− 15m" onPress={() => emit(h, m - 15)} colors={colors} />
          <StepButton label="+ 15m" onPress={() => emit(h, m + 15)} colors={colors} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { width: '100%', marginTop: 6 },
  lbl: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  card: { width: '100%', minHeight: 120, borderRadius: 24, borderWidth: 1, padding: 20, alignItems: 'stretch' },
  value: { fontSize: 38, fontWeight: '800', textAlign: 'center', letterSpacing: 1, marginBottom: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  btnWrap: { flexGrow: 1, flexBasis: 120, minWidth: 120 },
  btn: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnTxt: { fontSize: 16, fontWeight: '800' },
});
