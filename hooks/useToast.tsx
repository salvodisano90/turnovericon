// hooks/useToast.tsx — animated toast system

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useTheme } from './useTheme';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICON: Record<ToastType, string> = { success: '✓', info: 'i', warning: '!', error: '✕' };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter.current;
    setItems((prev) => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  const tint = (t: ToastType) =>
    t === 'success' ? colors.green : t === 'warning' ? colors.yellow : t === 'error' ? colors.red : colors.blue;

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.stack, { bottom: insets.bottom + 70 }]}>
        {items.map((t) => (
          <Animated.View
            key={t.id}
            entering={FadeInDown.springify().damping(18)}
            exiting={FadeOutDown.duration(220)}
            style={[styles.toast, { backgroundColor: colors.mode === 'dark' ? '#2C2C2E' : '#1C1C1E' }]}
          >
            <View style={[styles.icon, { backgroundColor: tint(t.type) }]}>
              <Text style={styles.iconTxt}>{ICON[t.type]}</Text>
            </View>
            <Text style={styles.msg} numberOfLines={3}>
              {t.message}
            </Text>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: 560,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  icon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  msg: { flex: 1, color: '#fff', fontSize: 13.5, fontWeight: '500' },
});
