// components/SheetHeader.tsx

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { useTheme } from '../hooks/useTheme';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  left?: React.ReactNode;
}

export default function SheetHeader({ title, subtitle, onClose, left }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.head, { borderBottomColor: colors.separator }]}>
      <View style={styles.row}>
        {left || (
          <Pressable onPress={onClose} hitSlop={8} style={[styles.back, { backgroundColor: colors.card2 }]}>
            <Icon name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.sub, { color: colors.text2 }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      <Pressable style={[styles.x, { backgroundColor: colors.card2 }]} onPress={onClose} hitSlop={8}>
        <Icon name="close" size={20} color={colors.text2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 72, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 13, fontWeight: '500', marginTop: 1 },
  x: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
