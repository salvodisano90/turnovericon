// components/ManageSheet.tsx — bottom sheet stile Apple per "Gestisci": titolo + sottotitolo + righe azione.
// Materiale GLASS, righe con tile-icona (SF-like) + chevron, azione distruttiva in rosso, Annulla, X.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { useTheme } from '../hooks/useTheme';
import { GLASS, MOTION } from '../utils/designSystem';

export interface ManageAction { icon: string; title: string; subtitle?: string; destructive?: boolean; onPress: () => void; }

export default function ManageSheet({ visible, title, subtitle, actions, onClose }: {
  visible: boolean; title: string; subtitle?: string; actions: ManageAction[]; onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(40)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(y, { toValue: 0, damping: 20, stiffness: 240, mass: 0.8, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: MOTION.modalOpen.dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    } else { y.setValue(40); op.setValue(0); }
  }, [visible, y, op]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={{ opacity: op, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      </Pressable>
      <View style={[styles.wrap, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { backgroundColor: colors.card2, borderColor: GLASS.border, transform: [{ translateY: y }], opacity: op }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: colors.text3 }]}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={[styles.close, { backgroundColor: colors.line }]}>
              <Icon name="close" size={18} color={colors.text3} />
            </Pressable>
          </View>
          {actions.map((a, i) => (
            <Pressable key={i} onPress={() => { onClose(); setTimeout(a.onPress, 220); }} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.line : 'transparent' }]}>
              <View style={[styles.tile, { backgroundColor: a.destructive ? colors.red + '22' : colors.blueSoft }]}>
                <Icon name={a.icon} size={22} color={a.destructive ? colors.red : colors.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: a.destructive ? colors.red : colors.text }]}>{a.title}</Text>
                {a.subtitle ? <Text style={[styles.rowSub, { color: colors.text3 }]}>{a.subtitle}</Text> : null}
              </View>
              <Icon name="chevron-forward" size={18} color={colors.text3} />
            </Pressable>
          ))}
          <Pressable onPress={onClose} style={[styles.cancel, { backgroundColor: colors.line }]}>
            <Text style={[styles.cancelTxt, { color: colors.text }]}>Annulla</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  sheet: { borderRadius: 28, borderWidth: 1, padding: 16, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 15, fontWeight: '400', marginTop: 2 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 16, marginBottom: 8 },
  tile: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  rowSub: { fontSize: 13, fontWeight: '400', marginTop: 2 },
  cancel: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  cancelTxt: { fontSize: 17, fontWeight: '600' },
});
