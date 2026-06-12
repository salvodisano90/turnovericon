// components/FloatingBottomNavigation.tsx — tab bar flottante "liquid glass" (custom per expo-router Tabs).
// Tab bar liquid-glass: BlurView reale se expo-blur è installato, altrimenti pannello traslucido (fallback).
import React, { useEffect, useRef } from 'react';
import { Pressable, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../hooks/useStore';
import { GLASS, MOTION } from '../utils/designSystem';
import PressableScale from './PressableScale';
import Icon from './Icon';
// expo-blur opzionale: blur reale dopo `npx expo install expo-blur`, altrimenti fallback al pannello traslucido.
import * as ExpoBlur from 'expo-blur';
const BlurView: any = (ExpoBlur as any) && (ExpoBlur as any).BlurView;

const BAR_BG = 'rgba(25,25,25,0.55)'; // materiale bar (spec) — più presente del GLASS delle card

const META: Record<string, { icon: string; label: string; badgeKey?: 'pending' }> = {
  index: { icon: 'home', label: 'Dashboard' },
  pianificazione: { icon: 'calendar', label: 'Piano' },
  personale: { icon: 'people', label: 'Personale', badgeKey: 'pending' },
  controllo: { icon: 'pulse', label: 'Controllo' },
  account: { icon: 'person', label: 'Account' },
};

export default function FloatingBottomNavigation({ state, descriptors, navigation }: any) {
  const { colors } = useTheme();
  const { role, requests } = useStore();
  const pendingCount = role === 'OWNER' ? (requests || []).filter((r: any) => r.stato === 'pending').length : 0;
  const insets = useSafeAreaInsets();
  const STAFF_TABS = ['index', 'account'];
  const [tabL, setTabL] = React.useState<Record<string, { x: number; w: number }>>({});
  const pillX = React.useRef(new Animated.Value(0)).current;
  const pillO = React.useRef(new Animated.Value(0)).current;
  const routes = state.routes.filter((r) => META[r.name] && (descriptors[r.key]?.options as any)?.href !== null && (role !== 'STAFF' || STAFF_TABS.includes(r.name)));

  const PILL_W = 64;
  const activeKey = state.routes[state.index] && state.routes[state.index].key;
  React.useEffect(() => {
    const l = activeKey ? tabL[activeKey] : undefined;
    if (!l) return;
    const to = l.x + l.w / 2 - PILL_W / 2;
    Animated.parallel([
      // spring morbida ~180ms: la pillola SCORRE fisicamente (mai fade, mai mount/unmount)
      Animated.spring(pillX, { toValue: to, damping: 18, stiffness: 260, mass: 0.7, useNativeDriver: true }),
      Animated.timing(pillO, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }), // solo prima comparsa al primo layout
    ]).start();
  }, [activeKey, tabL, pillX, pillO]);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: (insets.bottom || 0) + 24 }]}>
      <View style={[styles.bar, { backgroundColor: BAR_BG, borderColor: GLASS.border, overflow: 'hidden' }]}>
        {BlurView ? <BlurView intensity={GLASS.blur} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
        <View pointerEvents="none" style={styles.topEdge} />
        <View pointerEvents="none" style={styles.bottomEdge} />
        <Animated.View pointerEvents="none" style={[styles.slidePill, { opacity: pillO, transform: [{ translateX: pillX }] }]} />
        {routes.map((route) => {
          const focused = state.routes[state.index].key === route.key;
          const m = META[route.name];
          const onPress = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigation.navigate(route.name as never);
          };
          return (
            <AnimatedTab key={route.key} focused={focused} onPress={onPress} icon={m.icon} label={m.label} colors={colors} badge={m.badgeKey === 'pending' ? pendingCount : 0} onTabLayout={(x: number, w: number) => setTabL((prev) => (prev[route.key] && prev[route.key].x === x && prev[route.key].w === w ? prev : { ...prev, [route.key]: { x, w } }))} />
          );
        })}
      </View>
    </View>
  );
}
function AnimatedTab({ focused, onPress, icon, label, colors, badge = 0, onTabLayout }: { focused: boolean; onPress: () => void; icon: string; label: string; colors: any; badge?: number; onTabLayout: (x: number, w: number) => void }) {
  const scale = useRef(new Animated.Value(focused ? 1 : MOTION.tabChange.enterScaleFrom)).current;
  const op = useRef(new Animated.Value(focused ? 1 : MOTION.tabChange.exitOpacity)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: focused ? 1 : MOTION.tabChange.enterScaleFrom, duration: MOTION.tabChange.dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(op, { toValue: focused ? 1 : MOTION.tabChange.exitOpacity, duration: MOTION.tabChange.dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [focused, scale, op]);
  return (
    <Pressable onPress={onPress} style={styles.tab} onLayout={(e) => onTabLayout(e.nativeEvent.layout.x, e.nativeEvent.layout.width)}>
      <Animated.View style={{ transform: [{ scale }], opacity: op, alignItems: 'center' }}>
        <View style={styles.pillWrap}>
          <Icon name={icon} size={32} color={focused ? colors.text : colors.text3} />
          {badge > 0 ? (
            <View style={styles.badge}><Text style={styles.badgeTxt}>{badge > 9 ? '9+' : badge}</Text></View>
          ) : null}
        </View>
        <Text style={[styles.lbl, { color: focused ? colors.text : colors.text3 }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: '4%', right: '4%', bottom: 0, alignItems: 'stretch' }, // larghezza 92%
  bar: { flexDirection: 'row', height: 76, borderRadius: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  tab: { alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 56 },
  pillWrap: { paddingHorizontal: 18, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  topEdge: { position: 'absolute', top: 0, left: 19, right: 19, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  bottomEdge: { position: 'absolute', bottom: 0, left: 19, right: 19, height: 1, backgroundColor: 'rgba(0,0,0,0.30)' },
  slidePill: { position: 'absolute', top: 14, left: 0, width: 64, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)' }, // pillola neutra, radius massimo
  lbl: { fontSize: 13, fontWeight: '500' },
  badge: { position: 'absolute', top: 0, right: 8, minWidth: 12, height: 12, borderRadius: 6, paddingHorizontal: 3, backgroundColor: '#FF2D55', alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { fontSize: 8.5, fontWeight: '800', color: '#FFFFFF' },
});
