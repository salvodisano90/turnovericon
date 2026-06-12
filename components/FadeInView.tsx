// components/FadeInView.tsx — ingresso discreto al mount: fade + slide verticale minima. Default 200ms (grafici: 500ms).
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';

export default function FadeInView({ children, style, duration = 200, dy = 6, delay = 0, scaleFrom = 1 }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; duration?: number; dy?: number; delay?: number; scaleFrom?: number }) {
  const o = useRef(new Animated.Value(0)).current;
  const t = useRef(new Animated.Value(dy)).current;
  const sc = useRef(new Animated.Value(scaleFrom)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(o, { toValue: 1, duration, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(sc, { toValue: 1, duration, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [o, t, sc, duration, delay]);
  return <Animated.View style={[{ opacity: o, transform: [{ translateY: t }, { scale: sc }] }, style]}>{children}</Animated.View>;
}
