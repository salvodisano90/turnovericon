// screens/LoginScreen.tsx — accesso Coordinatore (email+password) / Staff-Capoturno (sola email).
// Collegato a backend.auth: con i placeholder offline mostra "backend non collegato";
// diventa reale appena inietti l'adapter Supabase (vedi guida).

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import SheetHeader from '../components/SheetHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import { backend, AuthUser } from '../services/backend';

export default function LoginScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'coordinatore' | 'staff'>('coordinatore');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  const loginCoord = async () => {
    if (!email.trim()) { toast.show('Inserisci l\u2019email', 'error'); return; }
    setBusy(true);
    try { const u = await backend.auth.loginCoordinatore(email.trim(), password); setUser(u); toast.show('Accesso effettuato', 'success'); }
    catch (e: any) { toast.show(e && e.message ? e.message : 'Accesso non riuscito', 'error'); }
    finally { setBusy(false); }
  };
  const sendOtp = async () => {
    if (!email.trim()) { toast.show('Inserisci l\u2019email', 'error'); return; }
    setBusy(true);
    try { await backend.auth.requestStaffOtp(email.trim()); setOtpSent(true); toast.show('Codice inviato via email', 'success'); }
    catch (e: any) { toast.show(e && e.message ? e.message : 'Invio non riuscito', 'error'); }
    finally { setBusy(false); }
  };
  const verifyOtp = async () => {
    if (!otp.trim()) { toast.show('Inserisci il codice', 'error'); return; }
    setBusy(true);
    try { const u = await backend.auth.verifyStaffOtp(email.trim(), otp.trim()); setUser(u); toast.show('Accesso effettuato', 'success'); }
    catch (e: any) { toast.show(e && e.message ? e.message : 'Codice non valido', 'error'); }
    finally { setBusy(false); }
  };
  const forgotPassword = async () => {
    if (!email.trim()) { toast.show('Inserisci prima l\u2019email', 'error'); return; }
    try { await backend.auth.resetPassword(email.trim()); toast.show('Email di recupero inviata', 'success'); }
    catch (e: any) { toast.show(e && e.message ? e.message : 'Operazione non riuscita', 'error'); }
  };
  const logout = async () => { await backend.auth.logout(); setUser(null); setOtpSent(false); setOtp(''); setPassword(''); };

  const input = [styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.card2 }];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Account" subtitle={backend.auth.isBackendConnected() ? 'Accedi al tuo spazio' : 'Backend non ancora collegato (modalità offline)'} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        {user ? (
          <Card>
            <Text style={[styles.name, { color: colors.text }]}>{user.nome}</Text>
            <Text style={[styles.sub, { color: colors.text3 }]}>{user.email} · {user.ruolo}</Text>
            <Button title="Esci" variant="danger" full icon="log-out-outline" onPress={logout} style={{ marginTop: 14 }} />
          </Card>
        ) : (
          <>
            <View style={styles.tabs}>
              {([['coordinatore', 'Coordinatore'], ['staff', 'Staff / Capoturno']] as const).map(([k, l]) => {
                const on = mode === k;
                return <Pressable key={k} onPress={() => { setMode(k); setOtpSent(false); setOtp(''); }} style={[styles.tab, { backgroundColor: on ? colors.blueSoft : colors.card2, borderColor: on ? colors.blue : colors.separator }]}><Text style={[styles.tabTxt, { color: on ? colors.blue : colors.text2 }]}>{l}</Text></Pressable>;
              })}
            </View>
            <Card>
              {mode === 'coordinatore' ? (
                <>
                  <Text style={[styles.lbl, { color: colors.text3 }]}>Email</Text>
                  <TextInput style={input} placeholder="email@ospedale.it" placeholderTextColor={colors.text3} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
                  <Text style={[styles.lbl, { color: colors.text3, marginTop: 12 }]}>Password</Text>
                  <TextInput style={input} placeholder="password" placeholderTextColor={colors.text3} secureTextEntry value={password} onChangeText={setPassword} />
                  <Button title={busy ? 'Accesso…' : 'Accedi'} full icon="log-in-outline" disabled={busy} onPress={loginCoord} style={{ marginTop: 16 }} />
                  <Pressable onPress={forgotPassword} hitSlop={8} style={{ marginTop: 12, alignSelf: 'center' }}><Text style={[styles.linkTxt, { color: colors.blue }]}>Password dimenticata?</Text></Pressable>
                </>
              ) : (
                <>
                  <Text style={[styles.lbl, { color: colors.text3 }]}>Email autorizzata</Text>
                  <TextInput style={[input, otpSent && { opacity: 0.6 }]} placeholder="email@ospedale.it" placeholderTextColor={colors.text3} autoCapitalize="none" keyboardType="email-address" editable={!otpSent} value={email} onChangeText={setEmail} />
                  {!otpSent ? (
                    <>
                      <Text style={[styles.hint, { color: colors.text3 }]}>Lo staff accede solo con l'email autorizzata dal coordinatore: nessuna password. Riceverai un codice via email.</Text>
                      <Button title={busy ? 'Invio…' : 'Invia codice'} full icon="mail-outline" disabled={busy} onPress={sendOtp} style={{ marginTop: 16 }} />
                    </>
                  ) : (
                    <>
                      <Text style={[styles.lbl, { color: colors.text3, marginTop: 12 }]}>Codice ricevuto via email</Text>
                      <TextInput style={input} placeholder="123456" placeholderTextColor={colors.text3} keyboardType="number-pad" value={otp} onChangeText={setOtp} />
                      <Button title={busy ? 'Verifica…' : 'Accedi'} full icon="log-in-outline" disabled={busy} onPress={verifyOtp} style={{ marginTop: 16 }} />
                      <Pressable onPress={sendOtp} hitSlop={8} style={{ marginTop: 12, alignSelf: 'center' }}><Text style={[styles.linkTxt, { color: colors.blue }]}>Reinvia codice</Text></Pressable>
                    </>
                  )}
                </>
              )}
            </Card>
            {!backend.auth.isBackendConnected() ? (
              <Card style={{ marginTop: 12, backgroundColor: colors.card2 }}>
                <Text style={[styles.hint, { color: colors.text2 }]}>Il backend non è ancora configurato: l'app funziona in locale (offline). Segui la guida per collegare Supabase e abilitare login e sincronizzazione multi-dispositivo.</Text>
              </Card>
            ) : null}
          </>
        )}
        <Button title="Chiudi" variant="ghost" full onPress={() => router.back()} style={{ marginTop: 14 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabTxt: { fontSize: 14, fontWeight: '700' },
  lbl: { fontSize: 12, marginBottom: 6 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, borderWidth: 1 },
  hint: { fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  linkTxt: { fontSize: 13, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
});
