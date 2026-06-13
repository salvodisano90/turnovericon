// components/SeasonalEditor.tsx — editor stagioni: date + catalogo matrici (STANDARD + PERSONALIZZATE) per stagione.
// Catalogo = MATRICI standard + matriciCustom (nessuna differenza). "+ Nuova" apre l'editor e al rientro auto-seleziona.
// Riusa validateSeasonalConfig/addMatriceCustom (nessuna logica nuova).
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../hooks/useStore';
import PressableScale from './PressableScale';
import Icon from './Icon';
import { Season, SeasonalConfig, SeasonRange } from '../types';
import { validateSeasonalConfig } from '../services/matriceResolver';
import { matriceBridge } from '../services/matriceBridge';
import { MATRICI } from '../utils/constants';
import { showContextMenu } from '../utils/contextMenu';

const SEASONS: { key: Season; label: string }[] = [
  { key: 'primavera', label: 'Primavera' }, { key: 'estate', label: 'Estate' },
  { key: 'autunno', label: 'Autunno' }, { key: 'inverno', label: 'Inverno' },
];
const pad = (n: number) => String(n).padStart(2, '0');

function NumStep({ value, onDelta, colors }: { value: number; onDelta: (d: number) => void; colors: any }) {
  return (
    <View style={styles.numWrap}>
      <PressableScale onPress={() => onDelta(-1)} hitSlop={6}><View style={[styles.numBtn, { backgroundColor: colors.card2 }]}><Text style={[styles.numSym, { color: colors.blue }]}>−</Text></View></PressableScale>
      <Text style={[styles.numVal, { color: colors.text }]}>{pad(value)}</Text>
      <PressableScale onPress={() => onDelta(1)} hitSlop={6}><View style={[styles.numBtn, { backgroundColor: colors.card2 }]}><Text style={[styles.numSym, { color: colors.blue }]}>+</Text></View></PressableScale>
    </View>
  );
}

export default function SeasonalEditor({ cfg, onChange }: { cfg: SeasonalConfig; onChange: (c: SeasonalConfig) => void }) {
  const { colors } = useTheme();
  const { matriciCustom, addMatriceCustom } = useStore();
  const cat = useMemo(() => [...MATRICI, ...matriciCustom], [matriciCustom]);
  const v = useMemo(() => validateSeasonalConfig(cfg, cat.map((m) => m.id)), [cfg, cat]);
  const isCustom = (id?: string) => !!id && matriciCustom.some((m) => m.id === id);

  // Auto-selezione: al rientro dall'editor, se una stagione aveva chiesto "+ Nuova", assegna la matrice creata.
  useFocusEffect(useCallback(() => {
    const { season, createdId } = matriceBridge.consume();
    if (season && createdId) onChange({ ...cfg, [season]: { ...(cfg as any)[season], matrice: createdId } });
  }, [cfg, onChange]));

  const setRange = (s: Season, patch: Partial<SeasonRange>) => onChange({ ...cfg, [s]: { ...(cfg as any)[s], ...patch } });
  const clampMonth = (m: number) => ((m - 1 + 12) % 12) + 1;
  const clampDay = (d: number) => ((d - 1 + 31) % 31) + 1;
  const createFor = (s: Season) => { matriceBridge.requestForSeason(s); router.push('/matrice-editor'); };
  const editCustom = (id: string) => router.push({ pathname: '/matrice-editor', params: { id } });
  const dupCustom = (id: string, s: Season) => {
    const m = matriciCustom.find((x) => x.id === id); if (!m) return;
    const nid = `CUST_${Date.now()}`;
    addMatriceCustom({ ...m, id: nid, label: `${m.label} Copia` });
    setRange(s, { matrice: nid });
  };

  const Chips = ({ list, sKey, sel }: { list: { id: string; label: string }[]; sKey: Season; sel?: string }) => (
    <View style={styles.chips}>
      {list.length === 0 ? <Text style={[styles.hint, { color: colors.text3 }]}>Nessuna</Text> : list.map((m) => (
        <PressableScale key={m.id} onPress={() => setRange(sKey, { matrice: m.id })}>
          <View style={[styles.chip, { backgroundColor: sel === m.id ? colors.blueSoft : colors.card2, borderColor: sel === m.id ? colors.blue : colors.line }]}>
            <Text style={[styles.chipTxt, { color: sel === m.id ? colors.blue : colors.text2 }]} numberOfLines={1}>{m.label}</Text>
          </View>
        </PressableScale>
      ))}
    </View>
  );

  return (
    <View>
      <View style={[styles.banner, { backgroundColor: (v.ok ? colors.green : colors.red) + '22', borderColor: v.ok ? colors.green : colors.red }]}>
        <Icon name={v.ok ? 'checkmark' : 'alert-circle'} size={18} color={v.ok ? colors.green : colors.red} />
        <Text style={[styles.bannerTxt, { color: v.ok ? colors.green : colors.red }]}>{v.ok ? 'Configurazione valida' : v.errors[0]}</Text>
      </View>

      {SEASONS.map((s) => {
        const r = (cfg as any)[s.key] || ({} as SeasonRange);
        const sel: string | undefined = r.matrice;
        return (
          <View key={s.key} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Text style={[styles.season, { color: colors.text }]}>{s.label}</Text>
            <View style={styles.dateRow}>
              <Text style={[styles.dl, { color: colors.text3 }]}>Dal</Text>
              <NumStep value={r.startDay || 1} onDelta={(d) => setRange(s.key, { startDay: clampDay((r.startDay || 1) + d) })} colors={colors} />
              <Text style={[styles.slash, { color: colors.text3 }]}>/</Text>
              <NumStep value={r.startMonth || 1} onDelta={(d) => setRange(s.key, { startMonth: clampMonth((r.startMonth || 1) + d) })} colors={colors} />
            </View>
            <View style={styles.dateRow}>
              <Text style={[styles.dl, { color: colors.text3 }]}>Al</Text>
              <NumStep value={r.endDay || 1} onDelta={(d) => setRange(s.key, { endDay: clampDay((r.endDay || 1) + d) })} colors={colors} />
              <Text style={[styles.slash, { color: colors.text3 }]}>/</Text>
              <NumStep value={r.endMonth || 1} onDelta={(d) => setRange(s.key, { endMonth: clampMonth((r.endMonth || 1) + d) })} colors={colors} />
            </View>

            <Text style={[styles.grp, { color: colors.text3 }]}>STANDARD</Text>
            <Chips list={MATRICI.map((m) => ({ id: m.id, label: m.label }))} sKey={s.key} sel={sel} />
            <Text style={[styles.grp, { color: colors.text3 }]}>PERSONALIZZATE</Text>
            <Chips list={matriciCustom.map((m) => ({ id: m.id, label: m.label }))} sKey={s.key} sel={sel} />

            <View style={styles.actions}>
              <PressableScale onPress={() => createFor(s.key)}><Text style={[styles.act, { color: colors.blue }]}>+ Nuova matrice</Text></PressableScale>
              {isCustom(sel) ? <PressableScale onPress={() => showContextMenu('Matrice personalizzata', [
                { label: 'Modifica', onPress: () => editCustom(sel as string) },
                { label: 'Duplica', onPress: () => dupCustom(sel as string, s.key) },
              ])}><Text style={[styles.act, { color: colors.text2 }]}>•••</Text></PressableScale> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  bannerTxt: { flex: 1, fontSize: 13, fontWeight: '800' },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12 },
  season: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dl: { fontSize: 12, fontWeight: '700', width: 52 },
  slash: { fontSize: 15, fontWeight: '800' },
  numWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numSym: { fontSize: 20, fontWeight: '800' },
  numVal: { fontSize: 17, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  grp: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: 12, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, maxWidth: 220 },
  chipTxt: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 12, fontWeight: '600', paddingVertical: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 14 },
  act: { fontSize: 13, fontWeight: '800' },
});
