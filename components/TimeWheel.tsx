// components/TimeWheel.tsx — selettore orario stile iOS (ruote ore/minuti).
// Build-safe: usa solo ScrollView con snap, nessuna dipendenza nativa (datetimepicker non installabile offline).
// Effetto picker: scrolling verticale, snap all'elemento, banda di selezione centrale.

import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DS } from '../utils/designSystem';
import PressableScale from './PressableScale';

const ITEM = 38;
const VISIBLE = 5;
const PAD = ITEM * Math.floor(VISIBLE / 2);

function Wheel({ data, value, onChange, color }: { data: number[]; value: number; onChange: (v: number) => void; color: string }) {
  const ref = useRef<ScrollView>(null);
  const idx = Math.max(0, data.indexOf(value));
  React.useEffect(() => {
    const t = setTimeout(() => ref.current && ref.current.scrollTo({ y: idx * ITEM, animated: false }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onEnd = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.round(y / ITEM);
    const v = data[Math.max(0, Math.min(data.length - 1, i))];
    if (v !== value) onChange(v);
  };
  return (
    <View style={{ height: ITEM * VISIBLE, flex: 1 }}>
      <ScrollView ref={ref} showsVerticalScrollIndicator={false} snapToInterval={ITEM} decelerationRate="fast" onMomentumScrollEnd={onEnd} onScrollEndDrag={onEnd} scrollEventThrottle={16} contentContainerStyle={{ paddingVertical: PAD }}>
        {data.map((n) => (
          <View key={n} style={{ height: ITEM, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: n === value ? '800' : '500', color: n === value ? color : DS.color.text3 }}>{String(n).padStart(2, '0')}</Text>
          </View>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={[styles.band, { top: PAD, height: ITEM, borderColor: DS.color.separator }]} />
    </View>
  );
}

export default function TimeWheel({ value, onChange }: { value: string; onChange: (hhmm: string) => void }) {
  const parts = (value || '00:00').split(':');
  const h = parseInt(parts[0], 10) || 0;
  const mRaw = parseInt(parts[1], 10) || 0;
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = Array.from({ length: 12 }, (_, i) => i * 5);
  const mSnap = mins.indexOf(mRaw) >= 0 ? mRaw : (Math.round(mRaw / 5) * 5) % 60;
  const set = (nh: number, nm: number) => onChange(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`);
  return (
    <View style={styles.row}>
      <Wheel data={hours} value={h} onChange={(v) => set(v, mSnap)} color={DS.color.info} />
      <Text style={[styles.colon, { color: DS.color.text2 }]}>:</Text>
      <Wheel data={mins} value={mSnap} onChange={(v) => set(h, v)} color={DS.color.info} />
    </View>
  );
}

// Campo tappabile che apre la ruota inline.
export function TimeWheelField({ value, onChange, label }: { value: string; onChange: (hhmm: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      {label ? <Text style={[styles.fieldLbl, { color: DS.color.text3 }]}>{label}</Text> : null}
      <PressableScale onPress={() => setOpen((o) => !o)}>
        <View style={[styles.pill, { backgroundColor: open ? DS.color.infoSoft : DS.color.card2, borderColor: open ? DS.color.info : DS.color.border }]}>
          <Text style={[styles.pillTxt, { color: open ? DS.color.info : DS.color.text }]}>{value || '--:--'}</Text>
        </View>
      </PressableScale>
      {open ? <View style={[styles.wheelBox, { backgroundColor: DS.color.bgElevated, borderColor: DS.color.border }]}><TimeWheel value={value} onChange={onChange} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  band: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  colon: { fontSize: 22, fontWeight: '800', marginHorizontal: 2 },
  fieldLbl: { fontSize: 11, marginBottom: 5 },
  pill: { height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pillTxt: { fontSize: 17, fontWeight: '700', letterSpacing: 1 },
  wheelBox: { marginTop: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
});
