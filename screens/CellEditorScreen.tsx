// screens/CellEditorScreen.tsx

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { MONTHS, STD_ORARI, TURNI, ASS_SOFT, ASS_COLOR, legacyAbsenceLabel } from '../utils/constants';
import { avatarColor, daysInMonth, getInf, getRep, initials, isWork, restMinutes, secCode } from '../utils/helpers';
import { getCell } from '../services/engine';
import { Turno } from '../types';
import SheetHeader from '../components/SheetHeader';
import Button from '../components/Button';

export default function CellEditorScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ infId: string; day: string }>();
  const infId = String(params.infId);
  const day = parseInt(String(params.day), 10);

  const { staff, reparti, currentPiano, prevPiano, setCell, year, month } = useStore();
  const inf = getInf(staff, infId);
  const dim = daysInMonth(year, month);
  const existing = getCell(currentPiano, infId, day);

  const [turno, setTurno] = useState<Turno>(existing ? existing.turno : 'R');
  const [repartoId, setRepartoId] = useState<string | null>(existing ? existing.repartoId : null);
  const [settore, setSettore] = useState<string | null>(existing ? existing.settore : null);

  const compat = useMemo(() => {
    if (!inf || !isWork(turno)) return [];
    return inf.reparti.map((id) => getRep(reparti, id)).filter((r): r is NonNullable<typeof r> => !!r && (r.settori[turno as 'M' | 'P' | 'N'] || 0) > 0);
  }, [inf, reparti, turno]);

  if (!inf) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <SheetHeader title="Turno" onClose={() => router.back()} />
        <Text style={{ color: colors.text2, padding: 16 }}>Operatore non trovato.</Text>
      </View>
    );
  }

  const restViolation = (turn: Turno, repOrari: typeof STD_ORARI): { side: string; a: string; b: string } | null => {
    if (!isWork(turn)) return null;
    // lato precedente: giorno-1 dello stesso mese, oppure ultimo giorno del mese precedente (confine)
    let prev = day > 1 ? getCell(currentPiano, infId, day - 1) : null;
    let po = prev && prev.repartoId ? (getRep(reparti, prev.repartoId)?.orari || STD_ORARI) : STD_ORARI;
    if (day === 1) {
      const pmY = month === 0 ? year - 1 : year;
      const pmM = month === 0 ? 11 : month - 1;
      prev = getCell(prevPiano, infId, daysInMonth(pmY, pmM));
      po = prev && prev.repartoId ? (getRep(reparti, prev.repartoId)?.orari || STD_ORARI) : STD_ORARI;
    }
    if (prev && isWork(prev.turno)) {
      if (restMinutes(prev.turno, turn, po, repOrari) < 660) return { side: day === 1 ? 'mese prec.' : 'prima', a: po[prev.turno].e, b: repOrari[turn].s };
    }
    const next = day < dim ? getCell(currentPiano, infId, day + 1) : null;
    if (next && isWork(next.turno)) {
      const no = next.repartoId ? (getRep(reparti, next.repartoId)?.orari || STD_ORARI) : STD_ORARI;
      if (restMinutes(turn, next.turno, repOrari, no) < 660) return { side: 'dopo', a: repOrari[turn].e, b: no[next.turno].s };
    }
    return null;
  };

  const occupiedBy = (code: string): string | null => {
    for (const s of staff) {
      if (s.id === infId) continue;
      const c = getCell(currentPiano, s.id, day);
      if (c && c.settore === code) return initials(s.nome);
    }
    return null;
  };

  const pickTurno = (t: Turno) => {
    setTurno(t);
    if (!isWork(t)) { setRepartoId(null); setSettore(null); }
  };
  const pickReparto = (id: string) => { setRepartoId(id); setSettore(null); };

  const onSave = () => {
    const fill = setCell(infId, day, turno, repartoId, isWork(turno) && repartoId ? settore : null);
    toast.show(`Aggiornato: ${inf.nome} → ${TURNI[turno].label} g${day}${settore && isWork(turno) ? ' (' + settore + ')' : ''}`, 'success');
    if (fill) setTimeout(() => toast.show(`AI: ${fill.inf.nome} copre ${fill.settore} g${day}`, 'info'), 500);
    router.back();
  };

  const findSub = () => {
    const rid = repartoId || (inf.reparti && inf.reparti[0]) || (reparti[0] ? reparti[0].id : '');
    if (!rid) { toast.show('Nessun reparto disponibile', 'warning'); return; }
    const p: Record<string, string> = { day: String(day), repId: rid, excludeId: infId };
    if (isWork(turno) && repartoId && settore) { p.turno = turno; p.settore = settore; }
    router.push({ pathname: '/sostituzioni', params: p });
  };

  const selOrari = repartoId ? (getRep(reparti, repartoId)?.orari || STD_ORARI) : STD_ORARI;
  const warn = restViolation(turno, selOrari);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, paddingBottom: insets.bottom }]}>
      <SheetHeader title={inf.nome} subtitle={`${day} ${MONTHS[month]} ${year} · ${inf.qualifica}`} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        {existing && existing.turno === 'F' ? (
          <View style={[styles.assBox, { backgroundColor: ASS_SOFT }]}>
            <Text style={[styles.assCode, { color: ASS_COLOR }]}>ASS · Assenza</Text>
            <Text style={[styles.assMot, { color: ASS_COLOR }]}>{(existing.motivo && existing.motivo.trim()) ? existing.motivo.trim() : (legacyAbsenceLabel(existing.assenza) || 'Assenza')}</Text>
            <Text style={[styles.assHint, { color: colors.text3 }]}>Le assenze si gestiscono da “Aggiungi / Modifica assenza”.</Text>
          </View>
        ) : null}
        <Text style={[styles.label, { color: colors.text2 }]}>TURNO</Text>
        <View style={styles.turnGrid}>
          {(['M', 'P', 'N', 'R', 'F'] as Turno[]).map((t) => {
            let dis = false;
            if (isWork(t)) {
              const prev = day > 1 ? getCell(currentPiano, infId, day - 1) : null;
              if (prev && isWork(prev.turno)) {
                const po = prev.repartoId ? (getRep(reparti, prev.repartoId)?.orari || STD_ORARI) : STD_ORARI;
                if (restMinutes(prev.turno, t, po, STD_ORARI) < 660) dis = true;
              }
              if (inf.esenzioniTurni.indexOf(t) >= 0) dis = true;
            }
            const sel = turno === t;
            return (
              <Pressable
                key={t}
                disabled={dis}
                onPress={() => pickTurno(t)}
                style={[styles.turnBtn, { borderColor: sel ? colors.blue : colors.line, backgroundColor: sel ? colors.blueSoft : colors.card, opacity: dis ? 0.35 : 1 }]}
              >
                <View style={[styles.turnSquare, { backgroundColor: colors.shift[t].bg }]}>
                  <Text style={[styles.turnLetter, { color: colors.shift[t].fg }]}>{t}</Text>
                </View>
                <Text style={[styles.turnName, { color: colors.text2 }]}>{TURNI[t].label}</Text>
              </Pressable>
            );
          })}
        </View>

        {isWork(turno) ? (
          <>
            <Text style={[styles.label, { color: colors.text2 }]}>REPARTO</Text>
            {compat.length === 0 ? (
              <View style={[styles.warn, { backgroundColor: colors.redSoft }]}>
                <Text style={[styles.warnTxt, { color: colors.red }]}>Nessun reparto di competenza ha settori per il turno {TURNI[turno].label}.</Text>
              </View>
            ) : null}
            {compat.map((r) => {
              const rv = restViolation(turno, r.orari);
              const dis = !!rv;
              const sel = repartoId === r.id;
              const gi = reparti.indexOf(r);
              return (
                <Pressable
                  key={r.id}
                  disabled={dis}
                  onPress={() => pickReparto(r.id)}
                  style={[styles.repCard, { borderColor: sel ? colors.blue : colors.line, backgroundColor: sel ? colors.blueSoft : colors.card, opacity: dis ? 0.4 : 1 }]}
                >
                  <View style={[styles.repIcon, { backgroundColor: avatarColor(gi) }]}>
                    <Text style={styles.repIconTxt}>{r.sigla}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.repName, { color: colors.text }]}>{r.nome}</Text>
                    <Text style={[styles.repSub, { color: colors.text2 }]}>
                      {r.orari[turno as 'M' | 'P' | 'N'].s}–{r.orari[turno as 'M' | 'P' | 'N'].e} · {r.settori[turno as 'M' | 'P' | 'N']} posti{dis ? ' · riposo <11h' : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {repartoId ? (
              <>
                <Text style={[styles.label, { color: colors.text2 }]}>SETTORE</Text>
                <View style={styles.secGrid}>
                  {Array.from({ length: getRep(reparti, repartoId)?.settori[turno as 'M' | 'P' | 'N'] || 0 }).map((_, i) => {
                    const rep = getRep(reparti, repartoId)!;
                    const code = secCode(turno, rep.sigla, i + 1);
                    const occ = occupiedBy(code);
                    const esente = inf.esenzioniSettori.indexOf(code) >= 0;
                    const sel = settore === code;
                    return (
                      <Pressable
                        key={code}
                        disabled={esente || !!occ}
                        onPress={() => setSettore(code)}
                        style={[styles.secBtn, { borderColor: sel ? colors.blue : colors.line, backgroundColor: sel ? colors.blueSoft : colors.card, opacity: occ || esente ? 0.55 : 1 }]}
                      >
                        <Text style={[styles.secCode, { color: sel ? colors.blue : colors.text }]}>{code}</Text>
                        {occ ? <Text style={[styles.secMeta, { color: colors.text3 }]}>{occ}</Text> : esente ? <Text style={[styles.secMeta, { color: colors.text3 }]}>esente</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {warn ? (
              <View style={[styles.warn, { backgroundColor: colors.redSoft }]}>
                <Text style={[styles.warnTxt, { color: colors.red }]}>⚠ Riposo &lt;11h ({warn.side}): fine {warn.a} → inizio {warn.b}. Modifica vietata dalla regola CCNL art. 26.</Text>
              </View>
            ) : null}
          </>
        ) : null}

        <Button title="Trova sostituto" variant="soft" full onPress={findSub} style={{ marginTop: 16 }} />
      </ScrollView>

      <View style={[styles.foot, { borderTopColor: colors.separator }]}>
        <Button title="Annulla" variant="secondary" full onPress={() => router.back()} style={{ flex: 1 }} />
        <Button title="Salva" variant="primary" full onPress={onSave} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  assBox: { borderRadius: 12, padding: 12, marginBottom: 14 },
  assCode: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  assMot: { fontSize: 16, fontWeight: '700' },
  assHint: { fontSize: 11.5, marginTop: 4 },
  container: { flex: 1 },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, marginTop: 8, marginBottom: 8 },
  turnGrid: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  turnBtn: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 10, borderRadius: 12, borderWidth: 2 },
  turnSquare: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  turnLetter: { fontSize: 15, fontWeight: '800' },
  turnName: { fontSize: 9.5, fontWeight: '600' },
  repCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11, borderRadius: 12, borderWidth: 2, marginBottom: 8 },
  repIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  repIconTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  repName: { fontSize: 14, fontWeight: '700' },
  repSub: { fontSize: 11.5, marginTop: 1 },
  secGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secBtn: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, borderWidth: 2, alignItems: 'center', minWidth: 56 },
  secCode: { fontSize: 13, fontWeight: '700' },
  secMeta: { fontSize: 9, fontWeight: '600', marginTop: 2 },
  warn: { borderRadius: 10, padding: 11, marginTop: 10 },
  warnTxt: { fontSize: 12.5, fontWeight: '600' },
  foot: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
