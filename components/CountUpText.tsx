// components/CountUpText.tsx — count-up 300ms del numero iniziale di una stringa ("85%", "12/15", "97"). Fallback statico se non numerica.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, TextStyle } from 'react-native';
import { MOTION } from '../utils/designSystem';

export default function CountUpText({ value, style, duration = MOTION.kpiUpdate.dur }: { value: string | number; style?: TextStyle | TextStyle[]; duration?: number }) {
  const str = String(value);
  const m = str.match(/^(\d+)([\s\S]*)$/);
  const target = m ? parseInt(m[1], 10) : null;
  const suffix = m ? m[2] : '';
  const anim = useRef(new Animated.Value(target ?? 0)).current;
  const [shown, setShown] = useState<number>(target ?? 0);
  const prev = useRef<number>(target ?? 0);

  useEffect(() => {
    if (target === null) return;
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    anim.setValue(prev.current);
    Animated.timing(anim, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => { prev.current = target; });
    return () => anim.removeListener(id);
  }, [target, duration, anim]);

  if (target === null) return <Text style={style}>{str}</Text>;
  return <Text style={style}>{shown}{suffix}</Text>;
}
