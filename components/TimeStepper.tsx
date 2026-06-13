// components/TimeStepper.tsx — gruppo orario a larghezza FISSA: [−] HH:MM [+].
// L'orario NON viene mai troncato: minWidth 88, centrato, senza numberOfLines/adjustsFontSizeToFit.
// Tap = ±15m, long-press = ±1h. Solo UI.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

const pad = (n: number) => String(n).padStart(2, '0');
function parse(value: string): { h: number; m: number } {
  const p = (value || '00:00').split(':');
  const h = Math.min(23, Math.max(0, parseInt(p[0], 10) || 0));
  const m = (Math.round((parseInt(p[1], 10) || 0) / 15) * 15) % 60;
  return { h, m };
}

function StepButton({ sym, onTap, onHold, colors }: { sym: string; onTap: () => void; onHold: () => void; colors: any }) {
  return (
    <Pressable onPress={onTap} onLongPress={onHold} delayLongPress={300} hitSlop={8} style={({ pressed }) => [styles.btn, { backgroundColor: colors.card2, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.btnSym, { color: colors.blue }]}>{sym}</Text>
    </Pressable>
  );
}

export function TimeStepperField({ value, onChange }: { value: string; onChange: (hhmm: string) => void }) {
  const { colors } = useTheme();
  const { h, m } = parse(value);
  const out = (nh: number, nm: number) => onChange(`${pad((nh + 24) % 24)}:${pad((nm + 60) % 60)}`);
  const stepMin = (dir: number) => { let nm = m + dir * 15, nh = h; if (nm >= 60) { nm -= 60; nh += 1; } else if (nm < 0) { nm += 60; nh -= 1; } out(nh, nm); };
  const stepHour = (dir: number) => out(h + dir, m);
  return (
    <View style={styles.group}>
      <StepButton sym="−" onTap={() => stepMin(-1)} onHold={() => stepHour(-1)} colors={colors} />
      <Text style={[styles.value, { color: colors.text }]}>{pad(h)}:{pad(m)}</Text>
      <StepButton sym="+" onTap={() => stepMin(1)} onHold={() => stepHour(1)} colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', alignItems: 'center', width: 176 },
  value: { flex: 1, minWidth: 88, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  btn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnSym: { fontSize: 22, fontWeight: '700', lineHeight: 24 },
});
