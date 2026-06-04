// screens/PersonaleScreen.tsx

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '../utils/confirm';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { countWork, monteTurni, classifyOperator } from '../services/engine';
import { daysInMonth, getCtr } from '../utils/helpers';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import Card from '../components/Card';
import Avatar from '../components/Avatar';

export default function PersonaleScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { staff, currentPiano, year, month, removeStaff } = useStore();
  const dim = daysInMonth(year, month);

  const confirmDelete = (id: string, nome: string) => {
    confirmAction(
      'Eliminare membro',
      `Vuoi eliminare ${nome} dallo staff?\nVerranno rimossi anche tutti i turni e le assegnazioni associate.`,
      () => {
        removeStaff(id);
        toast.show(`${nome} eliminato dallo staff`, 'success');
      },
      'Elimina',
    );
  };

  const pill = (
    <View style={[styles.pill, { backgroundColor: colors.blueSoft }]}>
      <Text style={[styles.pillTxt, { color: colors.blue }]}>{staff.length} membri</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Personale" actionIcon="person-add-outline" onAction={() => router.push('/staff-wizard')} pill={pill} />
      <ScrollView contentContainerStyle={styles.content}>
        {!staff.length ? (
          <EmptyState
            icon="people-outline"
            title="Nessun membro"
            desc="Aggiungi il personale: l'AI userà contratto, matrice ed esenzioni per generare i turni."
            actionLabel="Aggiungi membro"
            onAction={() => router.push('/staff-wizard')}
          />
        ) : (
          <Card noPadding>
            {staff.map((s, i) => {
              const work = countWork(currentPiano, s.id, dim);
              const mt = monteTurni(s);
              const over = work > mt;
              const liv = classifyOperator(s).categoria;
              const exp = typeof s.anniEsperienza === 'number' && s.anniEsperienza > 0 ? ` · ${s.anniEsperienza}a` : '';
              return (
                <View key={s.id} style={[styles.row, { borderBottomColor: colors.separator }, i === staff.length - 1 && styles.last]}>
                  <Pressable style={styles.bodyTap} onPress={() => router.push({ pathname: '/staff-detail', params: { infId: s.id } })}>
                    <Avatar name={s.nome} index={i} size={40} />
                    <View style={styles.body}>
                      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{s.nome}</Text>
                      <Text style={[styles.sub, { color: colors.text2 }]} numberOfLines={1}>{s.qualifica} · {getCtr(s.contratto).id} · {liv}{exp}</Text>
                    </View>
                  </Pressable>
                  <Text style={[styles.tag, { color: over ? colors.red : colors.text2, backgroundColor: over ? colors.redSoft : colors.card2 }]}>{work}/{mt}</Text>
                  <Pressable style={[styles.delBtn, { backgroundColor: colors.redSoft }]} hitSlop={8} onPress={() => confirmDelete(s.id, s.nome)}>
                    <Icon name="trash-outline" size={18} color={colors.red} />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 12, paddingBottom: 28 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillTxt: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  last: { borderBottomWidth: 0 },
  bodyTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12.5, marginTop: 1 },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, overflow: 'hidden' },
  delBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
