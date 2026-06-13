// components/ShiftBadge.tsx

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Cell } from '../types';
import { useTheme } from '../hooks/useTheme';
import { isWork } from '../utils/helpers';
import { getAssenza } from '../utils/constants';

interface Props {
  cell: Cell;
  size?: number;
  showSettore?: boolean;
}

export default function ShiftBadge({ cell, size = 32, showSettore = true }: Props) {
  const { colors } = useTheme();
  const ass = cell.turno === 'F' ? getAssenza() : undefined;
  const sc = colors.shift[cell.turno];
  const bg = ass ? ass.soft : sc.bg;
  const fg = ass ? ass.color : sc.fg;
  const code = ass ? ass.code : cell.turno;
  const pin = cell.deroghe && cell.deroghe.length ? colors.red
    : cell.locked && cell.turno !== 'F' ? colors.text3
      : cell.autoFilled ? colors.blue
        : null;
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: bg }]}>
      <Text style={[styles.letter, { color: fg, fontSize: size * (code.length > 1 ? 0.3 : 0.42) }]} numberOfLines={1}>{code}</Text>
      {showSettore && isWork(cell.turno) && cell.settore ? (
        <Text style={[styles.sc, { color: fg }]} numberOfLines={1}>
          {cell.settore}
        </Text>
      ) : null}
      {pin ? <View style={[styles.pin, { backgroundColor: pin, borderColor: colors.card }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontWeight: '800', lineHeight: undefined },
  sc: { fontSize: 11, fontWeight: '600', marginTop: -2 },
  pin: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
});
