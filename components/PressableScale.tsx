// components/PressableScale.tsx — pressione con micro-scala (1 → 0.97), nativa, senza dipendenze extra.
import React, { useRef } from 'react';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';

interface Props { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; scaleTo?: number; disabled?: boolean; hitSlop?: number; }

export default function PressableScale({ children, onPress, style, scaleTo = 0.97, disabled, hitSlop = 0 }: Props) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={hitSlop} onPressIn={() => to(scaleTo)} onPressOut={() => to(1)}>
      <Animated.View style={[{ transform: [{ scale: s }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
