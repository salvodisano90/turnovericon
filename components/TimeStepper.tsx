// components/TimeStepper.tsx — selettore orario a pulsanti +/- (niente scroll/snap/offset/OK).
// Ogni pressione aggiorna SUBITO il valore via onChange. Ore 0–23 e minuti step 5 con wrap.
// Usa i token del tema → visibile in dark e light. Target touch ≥ 44px.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import PressableScale from './PressableScale';

const pad = (n: number) => String(n).padStart(2, '0');

function parse(value: string): { h: number; m: number } {
  const p = (value || '00:00').split(':');
  const h = Math.min(23, Math.max(0, parseInt(p[0], 10) || 0));
  const mRaw = parseInt(p[1], 10) || 0;
  const m = (Math.round(mRaw / 5) * 5) % 60; // snap a step 5
  return { h, m };
}

function StepBtn({ sym, onPress, color, bg }: { sym: string; onPress: () => void; color: string; bg: string }) {
  return (
    <PressableScale onPress={onPress} hitSlop={6}>
      <View style={[styles.btn, { backgroundColor: bg }]}>
        <Text style={[styles.sym, { color }]}>{sym}</Text>
      </View>
    </PressableScale>
  );
}

export function TimeStepperField({ value, onChange, label }: { value: string; onChange: (hhmm: string) => void; label?: string }) {
  const { colors } = useTheme();
  const { h, m } = parse(value);
  const emit = (nh: number, nm: number) => onChange(`${pad(nh)}:${pad(nm)}`);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.lbl, { color: colors.text3 }]}>{label}</Text> : null}
      <View style={[styles.box, { backgroundColor: colors.card2, borderColor: colors.line }]}>
        {/* ORE */}
        <StepBtn sym="−" color={colors.blue} bg={colors.blueSoft} onPress={() => emit((h + 23) % 24, m)} />
        <Text style={[styles.val, { color: colors.text }]}>{pad(h)}</Text>
        <StepBtn sym="+" color={colors.blue} bg={colors.blueSoft} onPress={() => emit((h + 1) % 24, m)} />
        <Text style={[styles.colon, { color: colors.text2 }]}>:</Text>
        {/* MINUTI */}
        <StepBtn sym="−" color={colors.blue} bg={colors.blueSoft} onPress={() => emit(h, (m + 55) % 60)} />
        <Text style={[styles.val, { color: colors.text }]}>{pad(m)}</Text>
        <StepBtn sym="+" color={colors.blue} bg={colors.blueSoft} onPress={() => emit(h, (m + 5) % 60)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  lbl: { fontSize: 11, marginBottom: 5 },
  box: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  btn: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sym: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  val: { fontSize: 20, fontWeight: '800', minWidth: 30, textAlign: 'center' },
  colon: { fontSize: 20, fontWeight: '800', marginHorizontal: 2 },
});
