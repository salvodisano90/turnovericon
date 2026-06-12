// screens/StaffDashboardScreen.tsx — Dashboard dedicata STAFF: strumento personale di turni e richieste.
// 8 widget da DATI REALI (logica pura in utils/staffStats, ✅ testata) + sezioni Staff. Nessuna funzione OWNER visibile.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import GlassCard from '../components/GlassCard';
import Icon from '../components/Icon';
import KPICard from '../components/KPICard';
import PressableScale from '../components/PressableScale';
import QuickActionCard from '../components/QuickActionCard';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import { hoursBank } from '../services/hoursBank';
import { loadRepOp } from '../services/reperibilitaOp';
import { AREA } from '../utils/designSystem';
import { daysInMonth } from '../utils/helpers';
import { ferieGodute, ferieResidue, notificheRecenti, prossimaReperibilita, prossimoTurno, richiesteInAttesa, turnoDelGiorno } from '../utils/staffStats';
import { ReperibilitaOperatore } from '../types';

const TURNO_LBL: Record<string, string> = { M: 'Mattina', P: 'Pomeriggio', N: 'Notte', R: 'Riposo', S: 'Smonto', F: 'Assenza' };
const fmtIso = (iso: string) => iso.split('-').reverse().join('/');

export default function StaffDashboardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, currentEmail, members, requests, ctx, currentPiano, year, month } = useStore();

  const me = (members || []).find((m) => (m.email || '').toLowerCase() === (currentEmail || '').toLowerCase());
  const myInfId = me ? me.infId : undefined;
  const staffMe = useMemo(() => (ctx.staff || []).find((s) => s.id === myInfId), [ctx.staff, myInfId]);
  const displayName = me && me.nome ? me.nome.split(' ')[0] : 'Operatore';
  const piano = currentPiano || {};
  const now = new Date();
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
  const refDay = isCurrentMonth ? now.getDate() : 1;
  const dim = daysInMonth(year, month);

  const oggi = myInfId ? turnoDelGiorno(piano, myInfId, refDay) : null;
  const prossimo = myInfId ? prossimoTurno(piano, myInfId, refDay, dim) : null;
  const bankRow = useMemo(() => { try { return hoursBank(ctx, piano).find((r) => r.infId === myInfId) || null; } catch { return null; } }, [ctx, piano, myInfId]);
  const godute = myInfId ? ferieGodute(ctx.ferie || [], myInfId, year) : 0;
  const residue = ferieResidue(staffMe, godute);
  const pending = richiesteInAttesa(requests || [], myInfId);
  const recenti = notificheRecenti(requests || [], myInfId, 3);

  const [repNext, setRepNext] = useState<ReperibilitaOperatore | null>(null);
  useEffect(() => {
    let on = true;
    const iso = new Date().toISOString().slice(0, 10);
    loadRepOp().then((list) => { if (on) setRepNext(prossimaReperibilita(list || [], myInfId, iso)); }).catch(() => { if (on) setRepNext(null); });
    return () => { on = false; };
  }, [myInfId]);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const statoLbl = (st: string) => (st === 'approved' ? 'Approvata' : st === 'rejected' ? 'Rifiutata' : 'In attesa');
  const statoCol = (st: string) => (st === 'approved' ? colors.green : st === 'rejected' ? colors.red : colors.yellow);

  const SEZIONI = [
    { t: 'I miei turni', i: 'calendar-number-outline', to: '/i-miei-turni', c: AREA.pianificazione },
    { t: 'Richieste', i: 'list-outline', to: '/richieste', c: AREA.richieste },
    { t: 'Ferie e assenze', i: 'sunny-outline', to: '/ferie-wizard', c: AREA.ferie },
    { t: 'Desiderata', i: 'heart-outline', to: '/desiderata', c: AREA.desiderate },
    { t: 'Reperibilità', i: 'call-outline', to: '/reperibilita', c: AREA.reperibilita },
    { t: 'Banca ore', i: 'time-outline', to: '/banca-ore', c: AREA.bancaore },
    { t: 'Notifiche', i: 'notifications-outline', to: '/notifiche', c: AREA.report },
    { t: 'Profilo', i: 'person-circle-outline', to: '/profilo', c: AREA.account },
    { t: 'Sicurezza', i: 'lock-closed-outline', to: '/sicurezza', c: AREA.account },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.hello, { color: colors.text2 }]}>{greeting}</Text>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.role, { color: colors.text3 }]}>La tua area personale</Text>
        </View>
        <PressableScale onPress={() => router.push('/profilo')}>
          <Avatar nome={me && me.nome ? me.nome : 'Operatore'} ruolo="Infermiere" size={52} config={profile} />
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {/* Widget — solo dati reali */}
        <View style={styles.row}>
          <KPICard icon="sunny" label="Turno di oggi" value={oggi ? oggi : '—'} sub={oggi ? TURNO_LBL[oggi] || '' : 'Nessun piano'} subColor={colors.text3} />
          <KPICard icon="arrow-forward-circle" label="Prossimo turno" value={prossimo ? `${prossimo.day}` : '—'} sub={prossimo ? `${TURNO_LBL[prossimo.turno] || prossimo.turno}` : 'Nessuno nel mese'} subColor={colors.text3} />
        </View>
        <View style={styles.row}>
          <KPICard icon="time" label="Ore lavorate" value={bankRow ? `${bankRow.oreLavorate}h` : '—'} sub="Mese corrente" subColor={colors.text3} />
          <KPICard icon="hourglass" label="Monte ore" value={bankRow ? `${bankRow.oreContrattuali}h` : '—'} sub="Previsto" subColor={colors.text3} />
        </View>
        <View style={styles.row}>
          <KPICard icon="airplane" label="Ferie residue" value={`${residue}`} sub={staffMe && (staffMe as any).ferieAnnue ? `Su ${(staffMe as any).ferieAnnue} annui` : 'Stima su 26 annui'} subColor={colors.text3} />
          <KPICard icon="mail-unread" label="Richieste" value={`${pending}`} sub="In attesa" subColor={pending ? colors.yellow : colors.green} onPress={() => router.push('/richieste')} />
        </View>

        {/* Prossima reperibilità */}
        <PressableScale onPress={() => router.push('/reperibilita')} style={{ marginBottom: 12 }}>
          <GlassCard style={styles.line}>
            <View style={[styles.lineIcon, { backgroundColor: AREA.reperibilita + '22' }]}><Icon name="call-outline" size={20} color={AREA.reperibilita} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.lineTitle, { color: colors.text }]}>Prossima reperibilità</Text>
              <Text style={[styles.lineSub, { color: colors.text3 }]}>{repNext ? `${fmtIso(repNext.data)} · ${repNext.fascia || 'Tutto il giorno'}` : 'Nessuna in programma'}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.text3} />
          </GlassCard>
        </PressableScale>

        {/* Notifiche recenti */}
        <Text style={[styles.section, { color: colors.text }]}>Notifiche recenti</Text>
        <GlassCard style={{ marginBottom: 16 }}>
          {recenti.length ? recenti.map((r, i) => (
            <PressableScale key={i} onPress={() => router.push('/notifiche')}>
              <View style={[styles.notRow, i < recenti.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator }]}>
                <View style={[styles.dot, { backgroundColor: statoCol(r.stato) }]} />
                <Text style={[styles.notTxt, { color: colors.text2 }]} numberOfLines={1}>{statoLbl(r.stato)} · richiesta</Text>
                <Text style={[styles.notDate, { color: colors.text3 }]}>{(r.createdAt || '').slice(0, 10).split('-').reverse().join('/')}</Text>
              </View>
            </PressableScale>
          )) : <Text style={[styles.lineSub, { color: colors.text3, padding: 4 }]}>Nessuna notifica recente</Text>}
        </GlassCard>

        {/* Sezioni */}
        <Text style={[styles.section, { color: colors.text }]}>Le tue sezioni</Text>
        {Array.from({ length: Math.ceil(SEZIONI.length / 2) }, (_, ri) => (
          <View key={ri} style={styles.row}>
            {SEZIONI.slice(ri * 2, ri * 2 + 2).map((sz) => (
              <QuickActionCard key={sz.t} icon={sz.i} title={sz.t} onPress={() => router.push(sz.to as any)} color={sz.c} />
            ))}
            {SEZIONI.slice(ri * 2, ri * 2 + 2).length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingBottom: 8 },
  hello: { fontSize: 15, fontWeight: '600' },
  name: { fontSize: 32, fontWeight: '800' },
  role: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  section: { fontSize: 17, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lineIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  lineTitle: { fontSize: 15, fontWeight: '700' },
  lineSub: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  notRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  notTxt: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  notDate: { fontSize: 12, fontWeight: '600' },
});
