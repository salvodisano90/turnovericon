// components/ShiftGrid.tsx

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Piano, Staff } from '../types';
import { useTheme } from '../hooks/useTheme';
import { DOW } from '../utils/constants';
import { daysInMonth, isWeekend, jsDow, staffIndex } from '../utils/helpers';
import { getCell, getEmptyCell } from '../services/engine';
import Avatar from './Avatar';
import ShiftBadge from './ShiftBadge';

const NAME_W = 124;
const CELL_W = 38;
const ROW_H = 46;

interface Props {
  staff: Staff[];
  piano: Piano;
  year: number;
  month: number;
  onCellPress: (infId: string, day: number) => void;
  allStaff: Staff[];
}

export default function ShiftGrid({ staff, piano, year, month, onCellPress, allStaff }: Props) {
  const { colors } = useTheme();
  const dim = daysInMonth(year, month);
  const days = Array.from({ length: dim }, (_, i) => i + 1);

  if (!staff.length) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: colors.text2 }}>Nessun membro per questo filtro.</Text>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      {/* fixed name column */}
      <View style={{ width: NAME_W }}>
        <View style={[styles.corner, { height: ROW_H, borderColor: colors.separator, backgroundColor: colors.card2 }]}>
          <Text style={[styles.cornerTxt, { color: colors.text2 }]}>STAFF</Text>
        </View>
        {staff.map((inf) => (
          <View key={inf.id} style={[styles.nameCell, { height: ROW_H, borderColor: colors.separator }]}>
            <Avatar name={inf.nome} index={staffIndex(allStaff, inf.id)} size={28} />
            <View style={styles.nameTextWrap}>
              <Text style={[styles.nameTxt, { color: colors.text }]} numberOfLines={1}>{inf.nome}</Text>
              <Text style={[styles.nameSub, { color: colors.text3 }]} numberOfLines={1}>{inf.qualifica}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* scrollable day grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        <View>
          <View style={{ flexDirection: 'row' }}>
            {days.map((d) => {
              const we = isWeekend(year, month, d);
              return (
                <View key={d} style={[styles.dayHead, { width: CELL_W, height: ROW_H, borderColor: colors.separator, backgroundColor: we ? colors.card2 : colors.card }]}>
                  <Text style={[styles.dayNum, { color: we ? colors.red : colors.text }]}>{d}</Text>
                  <Text style={[styles.dayDow, { color: colors.text3 }]}>{DOW[jsDow(year, month, d)]}</Text>
                </View>
              );
            })}
          </View>
          {staff.map((inf) => (
            <View key={inf.id} style={{ flexDirection: 'row' }}>
              {days.map((d) => {
                const c = getCell(piano, inf.id, d) || getEmptyCell();
                return (
                  <Pressable
                    key={d}
                    onPress={() => onCellPress(inf.id, d)}
                    style={[styles.cell, { width: CELL_W, height: ROW_H, borderColor: colors.separator }]}
                  >
                    <ShiftBadge cell={c} size={30} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flexDirection: 'row' },
  empty: { padding: 30, alignItems: 'center' },
  corner: { justifyContent: 'center', paddingHorizontal: 10, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  cornerTxt: { fontSize: 11, fontWeight: '700' },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  nameTextWrap: { flex: 1, minWidth: 0 },
  nameTxt: { fontSize: 12.5, fontWeight: '600' },
  nameSub: { fontSize: 10 },
  dayHead: { alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  dayNum: { fontSize: 12, fontWeight: '700' },
  dayDow: { fontSize: 9, textTransform: 'uppercase' },
  cell: { alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
});
