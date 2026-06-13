// components/Button.tsx — pulsante unico del design system.
// icon accetta SIA una stringa (nome → <Icon/>) SIA un nodo. Prima `{icon}` stringa veniva
// renderizzato come TESTO (es. "download-outline"): qui le stringhe diventano vere icone.
import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import Icon from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: string | React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Button({ title, onPress, variant = 'primary', icon, loading, disabled, full, small, style }: Props) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const blocked = disabled || loading;

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
      onPress={blocked ? undefined : onPress}
      hitSlop={8}
      onPressIn={() => { scale.value = withTiming(0.97, { duration: 90 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 120 }); }}
      style={[styles.btn, small && styles.small, { backgroundColor: bg, opacity: blocked ? 0.5 : 1 }, full && styles.full, aStyle, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? (typeof icon === 'string' ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : icon) : null}
          <Text style={[styles.txt, small && styles.txtSmall, { color: fg } as TextStyle]}>{title}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  btn: { height: 56, borderRadius: 16, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  small: { height: 44, borderRadius: 12, paddingHorizontal: 16, gap: 8 },
  full: { alignSelf: 'stretch' },
  txt: { fontSize: 15, fontWeight: '700' },
  txtSmall: { fontSize: 13 },
});
