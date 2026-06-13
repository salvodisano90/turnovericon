// screens/SeasonalConfigScreen.tsx — Matrici stagionali, ridisegno Apple-grade (HIG).
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { MATRICI } from '../utils/constants';
import { validateSeasonalConfig } from '../services/matriceResolver';
import { Season, SeasonalConfig, SeasonRange } from '../types';

const SEASONS: { key: Season; label: string }[] = [
  { key: 'primavera', label: 'Primavera' }, { key: 'estate', label: 'Estate' },
  { key: 'autunno', label: 'Autunno' }, { key: 'inverno', label: 'Inverno' },
];
const STD_CICLI = ['QUINTA', 'SESTA', 'OTTAVA', 'DECIMA', 'D12H'];
const pad = (n: number) => String(n).padStart(2, '0');
const DAYS_IN = (m: number) => [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][(m - 1 + 12) % 12];

const DEFAULT_CFG: SeasonalConfig = {
  primavera: { matrice: 'DECIMA', startMonth: 3, startDay: 1, endMonth: 5, endDay: 31 },
  estate: { matrice: 'QUINTA', startMonth: 6, startDay: 1, endMonth: 9, endDay: 30 },
  autunno: { matrice: 'OTTAVA', startMonth: 10, startDay: 1, endMonth: 11, endDay: 30 },
  inverno: { matrice: 'SESTA', startMonth: 12, startDay: 1, endMonth: 2, endDay: 28 },
};

function DatePickerSheet({ visible, title, day, month, onConfirm, onClose }: {
  visible: boolean; title: string; day: number; month: number; onConfirm: (d: number, m: number) => void; onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState(day); const [m, setM] = useState(month);
  useEffect(() => { if (visible) { setD(day); setM(month); } }, [visible, day, month]);
  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const maxD = DAYS_IN(m);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} /></Pressable>
      <View style={[pk.wrap, { paddingBottom: insets.bottom + 16, backgroundColor: colors.card2, borderColor: colors.line }]}>
        <Text style={[pk.title, { color: colors.text }]}>{title}</Text>
        <View style={pk.cols}>
          <ScrollView style={pk.col} showsVerticalScrollIndicator={false}>
            {Array.from({ length: maxD }, (_, i) => i + 1).map((n) => (
              <Pressable key={n} onPress={() => setD(n)} style={[pk.opt, n === d && { backgroundColor: colors.blueSoft }]}>
                <Text style={[pk.optTxt, { color: n === d ? colors.blue : colors.text }]}>{pad(n)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView style={pk.col} showsVerticalScrollIndicator={false}>
            {months.map((mn, i) => (
              <Pressable key={mn} onPress={() => setM(i + 1)} style={[pk.opt, i + 1 === m && { backgroundColor: colors.blueSoft }]}>
                <Text style={[pk.optTxt, { color: i + 1 === m ? colors.blue : colors.text }]}>{mn}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <Pressable onPress={() => onConfirm(Math.min(d, maxD), m)} style={[pk.cta, { backgroundColor: colors.blue }]}>
          <Text style={pk.ctaTxt}>Conferma</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Stepper({ value, onDelta, colors }: { value: number; onDelta: (d: number) => void; colors: any }) {
  return (
    <View style={st.row}>
      <Pressable hitSlop={8} onPress={() => onDelta(-1)} style={[st.btn, { backgroundColor: colors.card2 }]}><Icon name="remove" size={18} color={colors.blue} /></Pressable>
      <Text style={[st.val, { color: colors.text }]}>{pad(value)}</Text>
      <Pressable hitSlop={8} onPress={() => onDelta(1)} style={[st.btn, { backgroundColor: colors.card2 }]}><Icon name="add" size={18} color={colors.blue} /></Pressable>
    </View>
  );
}

function Section({ open, onToggle, label, children, colors }: { open: boolean; onToggle: () => void; label: string; children: React.ReactNode; colors: any }) {
  const rot = React.useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => { Animated.timing(rot, { toValue: open ? 1 : 0, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, [open, rot]);
  return (
    <View style={[sc.box, { backgroundColor: colors.card, borderColor: open ? colors.blue : colors.line }]}>
      <Pressable onPress={onToggle} style={sc.head}>
        <View style={[sc.radio, { borderColor: open ? colors.blue : colors.text3 }]}>{open ? <View style={[sc.dot, { backgroundColor: colors.blue }]} /> : null}</View>
        <Text style={[sc.label, { color: colors.text }]}>{label}</Text>
        <Animated.View style={{ transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
          <Icon name="chevron-down" size={20} color={colors.text3} />
        </Animated.View>
      </Pressable>
      {open ? <View style={sc.body}>{children}</View> : null}
    </View>
  );
}

export default function SeasonalConfigScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { reparti, updateReparto, matriciCustom } = useStore();

  const [repId] = useState<string | null>(reparti.length ? reparti[0].id : null);
  const [cfg, setCfg] = useState<SeasonalConfig>(DEFAULT_CFG);
  const [openSeason, setOpenSeason] = useState<Season | ''>('primavera');
  const [picker, setPicker] = useState<{ season: Season; which: 'start' | 'end' } | null>(null);

  const rep = useMemo(() => reparti.find((r) => r.id === repId) || null, [reparti, repId]);
  useEffect(() => { if (rep && rep.seasonal) setCfg(rep.seasonal); else setCfg(DEFAULT_CFG); }, [repId]); // eslint-disable-line react-hooks/exhaustive-deps

  const matOptions = useMemo(() => {
    const std = MATRICI.filter((m) => STD_CICLI.indexOf(m.id) >= 0).map((m) => ({ id: m.id, label: m.label, durata: (m as any).durata || m.seq.length }));
    const cust = (matriciCustom || []).map((m) => ({ id: m.id, label: m.label, durata: (m as any).durata || m.seq.length }));
    return [...std, ...cust];
  }, [matriciCustom]);

  const setRange = (s: Season, patch: Partial<SeasonRange>) => setCfg((c) => ({ ...c, [s]: { ...c[s], ...patch } }));
  const setOp = (s: Season, patch: Record<string, any>) => setCfg((c) => ({ ...c, [s]: { ...c[s], op: { ...(c[s].op || {}), ...patch } } }));
  const setOpSet = (s: Season, t: 'M' | 'P' | 'N', delta: number) => setCfg((c) => {
    const op = c[s].op || {}; const settori = { ...(op.settori || {}) }; settori[t] = Math.max(0, (settori[t] != null ? settori[t] : 0) + delta);
    return { ...c, [s]: { ...c[s], op: { ...op, settori } } };
  });

  const allMatIds = useMemo(() => [...MATRICI, ...(matriciCustom || [])].map((m) => m.id), [matriciCustom]);
  const validation = useMemo(() => validateSeasonalConfig(cfg, allMatIds), [cfg, allMatIds]);

  const salva = () => {
    if (!rep) { toast.show('Crea prima un reparto', 'error'); return; }
    const missing = SEASONS.find((s) => !cfg[s.key] || !cfg[s.key].matrice);
    if (missing) { toast.show(`Seleziona una matrice per ${missing.label}`, 'error'); return; }
    updateReparto({ ...rep, matrice: 'STAGIONALE', seasonal: cfg });
    toast.show('Configurazione stagionale salvata', 'success');
    router.back();
  };

  const opOf = (s: Season) => cfg[s].op || {};
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={back} hitSlop={8} style={[styles.hBtn, { backgroundColor: colors.card2 }]}><Icon name="chevron-back" size={22} color={colors.text} /></Pressable>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={[styles.hTitle, { color: colors.text }]}>Matrici stagionali</Text>
          <Text style={[styles.hSub, { color: colors.text3 }]}>Assegna una matrice e un periodo a ogni stagione.</Text>
        </View>
        <Pressable onPress={back} hitSlop={8} style={[styles.hBtn, { backgroundColor: colors.card2 }]}><Icon name="close" size={22} color={colors.text} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {SEASONS.map((s) => {
          const r = cfg[s.key]; const op = opOf(s.key);
          const isOpen = openSeason === s.key;
          return (
            <View key={s.key} style={{ marginTop: 24 }}>
              <Section open={isOpen} onToggle={() => setOpenSeason(isOpen ? '' : s.key)} label={s.label} colors={colors}>
                <Text style={[styles.blockTitle, { color: colors.text }]}>Periodo</Text>
                <View style={styles.dateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.text3 }]}>Inizio</Text>
                    <Pressable onPress={() => setPicker({ season: s.key, which: 'start' })} style={[styles.dateField, { backgroundColor: colors.card2, borderColor: colors.line }]}>
                      <Text style={[styles.dateTxt, { color: colors.text }]}>{pad(r.startDay)}/{pad(r.startMonth)}</Text>
                      <Icon name="calendar-outline" size={18} color={colors.text3} />
                    </Pressable>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.text3 }]}>Fine</Text>
                    <Pressable onPress={() => setPicker({ season: s.key, which: 'end' })} style={[styles.dateField, { backgroundColor: colors.card2, borderColor: colors.line }]}>
                      <Text style={[styles.dateTxt, { color: colors.text }]}>{pad(r.endDay)}/{pad(r.endMonth)}</Text>
                      <Icon name="calendar-outline" size={18} color={colors.text3} />
                    </Pressable>
                  </View>
                </View>

                <Text style={[styles.blockTitle, { color: colors.text, marginTop: 24 }]}>Configurazione operativa</Text>
                <View style={styles.grid}>
                  {([['Settori M', 'M'], ['Settori P', 'P'], ['Settori N', 'N']] as Array<[string, 'M' | 'P' | 'N']>).map(([lab, t]) => (
                    <View key={t} style={[styles.opCard, { backgroundColor: colors.card2 }]}>
                      <Text style={[styles.opLabel, { color: colors.text3 }]}>{lab}</Text>
                      <Stepper value={(op.settori || {})[t] || 0} onDelta={(d) => setOpSet(s.key, t, d)} colors={colors} />
                    </View>
                  ))}
                  <View style={[styles.opCard, { backgroundColor: colors.card2 }]}>
                    <Text style={[styles.opLabel, { color: colors.text3 }]}>Settori chiusi</Text>
                    <Stepper value={op.settoriChiusi || 0} onDelta={(d) => setOp(s.key, { settoriChiusi: Math.max(0, (op.settoriChiusi || 0) + d) })} colors={colors} />
                  </View>
                  <View style={[styles.opCard, { backgroundColor: colors.card2 }]}>
                    <Text style={[styles.opLabel, { color: colors.text3 }]}>Posti letto</Text>
                    <Stepper value={op.postiLetto || 0} onDelta={(d) => setOp(s.key, { postiLetto: Math.max(0, (op.postiLetto || 0) + d) })} colors={colors} />
                  </View>
                  <View style={[styles.opCard, { backgroundColor: colors.card2 }]}>
                    <Text style={[styles.opLabel, { color: colors.text3 }]}>Copertura min %</Text>
                    <Stepper value={op.coperturaMin || 0} onDelta={(d) => setOp(s.key, { coperturaMin: Math.max(0, Math.min(100, (op.coperturaMin || 0) + d * 5)) })} colors={colors} />
                  </View>
                  <View style={[styles.opCard, { backgroundColor: colors.card2 }]}>
                    <Text style={[styles.opLabel, { color: colors.text3 }]}>Personale min</Text>
                    <Stepper value={op.personaleMin || 0} onDelta={(d) => setOp(s.key, { personaleMin: Math.max(0, (op.personaleMin || 0) + d) })} colors={colors} />
                  </View>
                </View>

                <Text style={[styles.blockTitle, { color: colors.text, marginTop: 24 }]}>Matrice</Text>
                <View style={styles.matGrid}>
                  {matOptions.map((m) => {
                    const sel = r.matrice === m.id;
                    return (
                      <Pressable key={m.id} onPress={() => setRange(s.key, { matrice: m.id })} style={[styles.matCard, { backgroundColor: sel ? colors.blueSoft : colors.card2, borderColor: sel ? colors.blue : 'transparent' }]}>
                        <Text style={[styles.matTitle, { color: sel ? colors.blue : colors.text }]} numberOfLines={1}>{m.label}</Text>
                        <Text style={[styles.matSub, { color: colors.text3 }]}>ciclo {m.durata}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable onPress={() => router.push({ pathname: '/matrice-editor', params: { season: s.key } } as any)} style={[styles.matCard, styles.matAdd, { borderColor: colors.line }]}>
                    <Text style={[styles.matTitle, { color: colors.text2 }]}>＋ Personalizzata</Text>
                    <Text style={[styles.matSub, { color: colors.text3 }]}>crea sequenza</Text>
                  </Pressable>
                </View>
              </Section>
            </View>
          );
        })}

        <View style={[styles.info, { backgroundColor: colors.card2, borderColor: colors.line }]}>
          <Icon name="information-circle" size={22} color={colors.blue} />
          <Text style={[styles.infoTxt, { color: colors.text3 }]}>
            Al cambio stagione il ciclo non riparte dal primo giorno: il motore mantiene la continuità usando il calendario assoluto. Le preferenze forti (solo mattina/pomeriggio) e i combo restano prioritari.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: colors.bg, borderTopColor: colors.line }]}>
        <Pressable onPress={salva} style={[styles.save, { backgroundColor: validation.ok ? colors.blue : colors.card2 }]}>
          <Icon name="save-outline" size={20} color={validation.ok ? '#FFFFFF' : colors.text3} />
          <Text style={[styles.saveTxt, { color: validation.ok ? '#FFFFFF' : colors.text3 }]}>Salva configurazione stagionale</Text>
        </Pressable>
      </View>

      <DatePickerSheet
        visible={!!picker}
        title={picker ? `${picker.which === 'start' ? 'Data inizio' : 'Data fine'} · ${SEASONS.find((x) => x.key === picker.season)?.label}` : ''}
        day={picker ? (picker.which === 'start' ? cfg[picker.season].startDay : cfg[picker.season].endDay) : 1}
        month={picker ? (picker.which === 'start' ? cfg[picker.season].startMonth : cfg[picker.season].endMonth) : 1}
        onConfirm={(d, m) => { if (picker) { if (picker.which === 'start') setRange(picker.season, { startDay: d, startMonth: m }); else setRange(picker.season, { endDay: d, endMonth: m }); } setPicker(null); }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 96, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  hBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hTitle: { fontSize: 28, fontWeight: '700' },
  hSub: { fontSize: 15, fontWeight: '400', marginTop: 2 },
  blockTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  dateRow: { flexDirection: 'row', gap: 16 },
  dateField: { height: 52, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  dateTxt: { fontSize: 17, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  opCard: { width: '47.5%', minHeight: 90, borderRadius: 20, padding: 16, justifyContent: 'space-between' },
  opLabel: { fontSize: 13, fontWeight: '500' },
  matGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  matCard: { width: '47.5%', minHeight: 72, borderRadius: 16, borderWidth: 1.5, padding: 14, justifyContent: 'center' },
  matAdd: { borderStyle: 'dashed', alignItems: 'flex-start' },
  matTitle: { fontSize: 15, fontWeight: '600' },
  matSub: { fontSize: 13, fontWeight: '400', marginTop: 4 },
  info: { flexDirection: 'row', gap: 12, marginTop: 24, padding: 16, borderRadius: 20, borderWidth: 1 },
  infoTxt: { flex: 1, fontSize: 13, fontWeight: '400', lineHeight: 19 },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  save: { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveTxt: { fontSize: 17, fontWeight: '700' },
});

const sc = StyleSheet.create({
  box: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1, fontSize: 22, fontWeight: '600' },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
});

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  val: { fontSize: 28, fontWeight: '700', minWidth: 44, textAlign: 'center' },
});

const pk = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  cols: { flexDirection: 'row', gap: 16, height: 220 },
  col: { flex: 1 },
  opt: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 4 },
  optTxt: { fontSize: 17, fontWeight: '600' },
  cta: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  ctaTxt: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
