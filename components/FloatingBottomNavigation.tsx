// components/FloatingBottomNavigation.tsx — tab bar flottante "liquid glass" (custom per expo-router Tabs).
// Tab bar liquid-glass: BlurView reale se expo-blur è installato, altrimenti pannello traslucido (fallback).
import React, { useEffect, useRef } from 'react';
import { Pressable, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import PressableScale from './PressableScale';
import Icon from './Icon';
// expo-blur opzionale: blur reale dopo `npx expo install expo-blur`, altrimenti fallback al pannello traslucido.
import * as ExpoBlur from 'expo-blur';
const BlurView: any = (ExpoBlur as any) && (ExpoBlur as any).BlurView;

const META: Record<string, { icon: string; label: string }> = {
  index: { icon: 'home', label: 'Dashboard' },
  pianificazione: { icon: 'calendar', label: 'Piano' },
  personale: { icon: 'people', label: 'Personale' },
  controllo: { icon: 'pulse', label: 'Controllo' },
  account: { icon: 'person', label: 'Account' },
};

export default function FloatingBottomNavigation({ state, descriptors, navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => META[r.name] && (descriptors[r.key]?.options as any)?.href !== null);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom ? insets.bottom - 4 : 16 }]}>
      <View style={[styles.bar, { backgroundColor: 'rgba(10,10,10,0.70)', borderColor: colors.line, overflow: 'hidden' }]}>
        {BlurView ? <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
        {routes.map((route) => {
          const focused = state.routes[state.index].key === route.key;
          const m = META[route.name];
          const onPress = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigation.navigate(route.name as never);
          };
          return (
            <AnimatedTab key={route.key} focused={focused} onPress={onPress} icon={m.icon} label={m.label} colors={colors} />
          );
        })}
      </View>
    </View>
  );
}
function AnimatedTab({ focused, onPress, icon, label, colors }: { focused: boolean; onPress: () => void; icon: string; label: string; colors: any }) {
  const scale = useRef(new Animated.Value(focused ? 1.06 : 1)).current;
  useEffect(() => {
    Animated.timing(scale, { toValue: focused ? 1.06 : 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [focused, scale]);
  const pop = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.08, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: focused ? 1.06 : 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Pressable onPress={pop} style={styles.tab}>
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
        <View style={[styles.pill, focused && { backgroundColor: 'rgba(77,163,255,0.18)' }]}>
          <Icon name={icon} size={28} color={focused ? colors.blue : colors.text3} />
        </View>
        <Text style={[styles.lbl, { color: focused ? colors.blue : colors.text3 }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 0, alignItems: 'stretch' },
  bar: { flexDirection: 'row', height: 84, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  tab: { alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 56 },
  pill: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 18 },
  lbl: { fontSize: 11, fontWeight: '700' },
});
