// components/PressableScale.tsx — pressione con micro-scala (1 → 0.98), timing da spec: press 130ms, release 160ms, curva morbida, zero rimbalzo.
import React, { useRef } from 'react';
import { Animated, Easing, Pressable, ViewStyle } from 'react-native';

interface Props { children: React.ReactNode; onPress?: () => void; style?: ViewStyle | ViewStyle[]; scaleTo?: number; disabled?: boolean; hitSlop?: number; }

export default function PressableScale({ children, onPress, style, scaleTo = 0.98, disabled, hitSlop = 0 }: Props) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number, d: number) => Animated.timing(s, { toValue: v, duration: d, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(scaleTo, 130)} onPressOut={() => to(1, 160)} disabled={disabled} hitSlop={hitSlop}>
      <Animated.View style={[{ transform: [{ scale: s }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
