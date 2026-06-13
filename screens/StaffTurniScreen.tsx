// screens/StaffTurniScreen.tsx — calendario personale operatore (sola lettura): giorno, data GG/MM/AAAA, turno/ferie/riposo.
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import SheetHeader from '../components/SheetHeader';
import { daysInMonth, fmtDataIt } from '../utils/helpers';
import { Turno } from '../types';

const WD = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const TLABEL: Record<string, string> = { M: 'Mattina', P: 'Pomeriggio', N: 'Notte', R: 'Riposo', F: 'Ferie', S: 'Smonto', G: 'Guardia' };

export default function StaffTurniScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { currentPiano, members, currentEmail, year, month } = useStore();
  const me = (members || []).find((m) => (m.email || '').toLowerCase() === (currentEmail || '').toLowerCase());
  const infId = me && me.infId;
  const dm = (infId && currentPiano[infId]) || {};
  const n = daysInMonth(year, month);
  const rows = useMemo(() => {
    const out: { d: number; date: Date; turno?: Turno }[] = [];
    for (let d = 1; d <= n; d++) out.push({ d, date: new Date(year, month, d), turno: (dm as any)[d] && (dm as any)[d].turno });
    return out;
  }, [dm, n, year, month]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="I miei turni" subtitle={`${MESI[month]} ${year}`} onClose={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        {!infId ? (
          <Text style={[styles.empty, { color: colors.text2 }]}>Nessun operatore collegato a questo accesso.</Text>
        ) : rows.map((r) => {
          const isWknd = r.date.getDay() === 0 || r.date.getDay() === 6;
          const sh = r.turno ? colors.shift[r.turno] : null;
          return (
            <View key={r.d} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.line }]}>
              <View style={styles.dateCol}>
                <Text style={[styles.wd, { color: isWknd ? colors.danger : colors.text3 }]}>{WD[r.date.getDay()]}</Text>
                <Text style={[styles.date, { color: colors.text }]}>{fmtDataIt(r.date)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: sh ? sh.bg : colors.card2 }]}>
                <Text style={[styles.badgeTxt, { color: sh ? sh.fg : colors.text3 }]}>{r.turno ? TLABEL[r.turno] || r.turno : '—'}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { fontSize: 13, textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  dateCol: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  wd: { fontSize: 12, fontWeight: '700', width: 34 },
  date: { fontSize: 15, fontWeight: '800' },
  badge: { minWidth: 96, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12, alignItems: 'center' },
  badgeTxt: { fontSize: 13, fontWeight: '800' },
});
