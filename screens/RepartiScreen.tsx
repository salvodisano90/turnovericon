// screens/RepartiScreen.tsx

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '../utils/confirm';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { TURNI } from '../utils/constants';
import { avatarColor, getMx, secCode } from '../utils/helpers';
import { Turno } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import Card from '../components/Card';
import Button from '../components/Button';

export default function RepartiScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { reparti, removeReparto } = useStore();

  const confirmRemove = (id: string, nome: string) => {
    confirmAction('Rimuovere reparto', `Eliminare il reparto ${nome}?`, () => {
      removeReparto(id);
      toast.show(`Reparto ${nome} rimosso`, 'success');
    }, 'Rimuovi');
  };

  const pill = (
    <View style={[styles.pill, { backgroundColor: colors.blueSoft }]}>
      <Text style={[styles.pillTxt, { color: colors.blue }]}>{reparti.length} reparti</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Reparti" actionIcon="add" onAction={() => router.push('/reparto-wizard')} pill={pill} />
      <ScrollView contentContainerStyle={styles.content}>
        {!reparti.length ? (
          <EmptyState
            icon="business-outline"
            title="Nessun reparto"
            desc="Crea il primo reparto con settori, orari e matrice di copertura."
            actionLabel="Crea reparto"
            onAction={() => router.push('/reparto-wizard')}
          />
        ) : (
          reparti.map((r, i) => {
            const mx = getMx(r.matrice);
            const tags: { code: string; turn: Turno }[] = [];
            (['M', 'P', 'N'] as Turno[]).forEach((t) => {
              for (let sn = 1; sn <= (r.settori[t as 'M' | 'P' | 'N'] || 0); sn++) tags.push({ code: secCode(t, r.sigla, sn), turn: t });
            });
            return (
              <Card key={r.id}>
                <View style={styles.head}>
                  <View style={[styles.icon, { backgroundColor: avatarColor(i) }]}>
                    <Text style={styles.iconTxt}>{r.sigla}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.text }]}>{r.nome}</Text>
                    <Text style={[styles.sub, { color: colors.text2 }]}>Sigla {r.sigla} · {mx ? mx.label : '–'}</Text>
                  </View>
                  <Pressable style={styles.del} hitSlop={10} onPress={() => confirmRemove(r.id, r.nome)}>
                    <Icon name="close-circle" size={26} color={colors.text3} />
                  </Pressable>
                </View>
                <View style={styles.statsRow}>
                  {(['M', 'P', 'N'] as ('M' | 'P' | 'N')[]).map((t) => (
                    <Text key={t} style={[styles.stat, { color: colors.text2 }]}>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{t}×{r.settori[t]}</Text> {r.orari[t].s}–{r.orari[t].e}
                    </Text>
                  ))}
                </View>
                <View style={styles.tags}>
                  {tags.map((tg) => (
                    <Text key={tg.code} style={[styles.tag, { color: TURNI[tg.turn].col, backgroundColor: colors.shift[tg.turn].bg }]}>{tg.code}</Text>
                  ))}
                </View>
                <Button
                  title="Modifica reparto"
                  variant="secondary"
                  small
                  full
                  icon={<Icon name="create-outline" size={16} color={colors.text} />}
                  onPress={() => router.push({ pathname: '/reparto-wizard', params: { id: r.id } })}
                  style={{ marginBottom: 8 }}
                />
                <Button
                  title="Rimuovi reparto"
                  variant="danger"
                  small
                  full
                  icon={<Icon name="trash-outline" size={16} color={colors.red} />}
                  onPress={() => confirmRemove(r.id, r.nome)}
                />
              </Card>
            );
          })
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  del: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  stat: { fontSize: 11.5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 12 },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, overflow: 'hidden' },
});
