// components/Button.tsx

import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: React.ReactNode;
  disabled?: boolean;
  full?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Button({ title, onPress, variant = 'primary', icon, disabled, full, small, style }: Props) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg =
    variant === 'primary' ? colors.blue
      : variant === 'danger' ? colors.redSoft
        : variant === 'soft' ? colors.blueSoft
          : variant === 'ghost' ? 'transparent'
            : colors.card2;
  const fg =
    variant === 'primary' ? '#FFFFFF'
      : variant === 'danger' ? colors.red
        : variant === 'soft' || variant === 'ghost' ? colors.blue
          : colors.text;

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => { scale.value = withTiming(0.97, { duration: 90 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 120 }); }}
      style={[
        styles.btn,
        small && styles.small,
        { backgroundColor: bg, opacity: disabled ? 0.45 : 1 },
        full && styles.full,
        aStyle,
        style,
      ]}
    >
      {icon}
      <Text style={[styles.txt, small && styles.txtSmall, { color: fg } as TextStyle]}>{title}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  small: { height: 38, borderRadius: 10, paddingHorizontal: 14 },
  full: { alignSelf: 'stretch' },
  txt: { fontSize: 16, fontWeight: '700' },
  txtSmall: { fontSize: 14 },
});
