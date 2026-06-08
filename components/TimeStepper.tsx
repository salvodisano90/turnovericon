// components/TimeStepper.tsx — orario COMPATTO iOS-first: [−] HH:MM [+] su una riga.
// Pulsanti piccoli (44px) che affiancano l'orario protagonista. Tap = ±15m, long-press = continuo.
// Nessuna libreria nativa (il TimePicker nativo richiederebbe @react-native-community/datetimepicker, non installato).
import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

const pad = (n: number) => String(n).padStart(2, '0');
function parse(value: string): { h: number; m: number } {
  const p = (value || '00:00').split(':');
  const h = Math.min(23, Math.max(0, parseInt(p[0], 10) || 0));
  const m = (Math.round((parseInt(p[1], 10) || 0) / 15) * 15) % 60;
  return { h, m };
}

function HoldButton({ sym, onStep, colors }: { sym: string; onStep: () => void; colors: any }) {
  const timer = useRef<any>(null);
  const start = () => {
    onStep();
    timer.current = setTimeout(() => { timer.current = setInterval(onStep, 110); }, 340);
  };
  const stop = () => { if (timer.current) { clearTimeout(timer.current); clearInterval(timer.current); timer.current = null; } };
  return (
    <Pressable onPressIn={start} onPressOut={stop} hitSlop={8} style={({ pressed }) => [styles.btn, { backgroundColor: colors.card2, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.btnSym, { color: colors.blue }]}>{sym}</Text>
    </Pressable>
  );
}

export function TimeStepperField({ value, onChange, label }: { value: string; onChange: (hhmm: string) => void; label?: string }) {
  const { colors } = useTheme();
  const { h, m } = parse(value);
  const step = (dir: number) => {
    let nm = m + dir * 15, nh = h;
    if (nm >= 60) { nm -= 60; nh += 1; } else if (nm < 0) { nm += 60; nh -= 1; }
    onChange(`${pad((nh + 24) % 24)}:${pad((nm + 60) % 60)}`);
  };
  return (
    <View style={styles.block}>
      {label ? <Text style={[styles.lbl, { color: colors.text3 }]}>{label}</Text> : null}
      <View style={styles.row}>
        <HoldButton sym="−" onStep={() => step(-1)} colors={colors} />
        <Text style={[styles.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{pad(h)}:{pad(m)}</Text>
        <HoldButton sym="+" onStep={() => step(1)} colors={colors} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { width: '100%' },
  lbl: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { flex: 1, fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 },
  btn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnSym: { fontSize: 24, fontWeight: '800', lineHeight: 26 },
});
