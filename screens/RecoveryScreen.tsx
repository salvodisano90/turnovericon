// screens/RecoveryScreen.tsx — Recupero password: flusso UI completo a 5 step (simulato in locale).
// Quando arriverà Supabase, basterà che il provider invii il codice via email (devCode sparisce).
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import { auth, emailValid, passwordIssue } from '../services/authProvider';

type Step = 1 | 2 | 3 | 4 | 5;

export default function RecoveryScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);

  const sendCode = async () => {
    setErr(null);
    if (!emailValid(email)) { setErr('Inserisci un indirizzo email valido'); return; }
    setBusy(true); const r = await auth.requestPasswordReset(email); setBusy(false);
    if (r.ok) { setDevCode(r.devCode); setStep(2); } else setErr('Impossibile inviare il codice');
  };
  const verify = async () => {
    setErr(null);
    if (code.trim().length !== 6) { setErr('Il codice è di 6 cifre'); return; }
    setBusy(true); const r = await auth.verifyCode(email, code); setBusy(false);
    if (r.ok) setStep(3);
    else setErr(r.error === 'expired' ? 'Codice scaduto: richiedine uno nuovo' : r.error === 'too_many' ? 'Troppi tentativi: richiedi un nuovo codice' : 'Codice non corretto');
  };
  const resend = async () => {
    setErr(null); setBusy(true); const r = await auth.resendCode(email); setBusy(false);
    if (r.ok) { setDevCode(r.devCode); toast.show('Nuovo codice inviato', 'success'); }
    else toast.show('Limite di reinvii raggiunto', 'error');
  };
  const savePwd = async () => {
    setErr(null);
    const issue = passwordIssue(pwd); if (issue) { setErr(issue); return; }
    if (pwd !== pwd2) { setErr('Le password non coincidono'); return; }
    setBusy(true); const r = await auth.setNewPassword(email, code, pwd); setBusy(false);
    if (r.ok) setStep(5); else setErr(r.ok === false ? r.error : 'Errore');
  };

  const dots = [1, 2, 3, 4].map((n) => (
    <View key={n} style={[styles.dot, { backgroundColor: step >= n ? colors.blue : colors.card2 }]} />
  ));

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Recupero password" subtitle={`Passaggio ${Math.min(step, 4)} di 4`} onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {step < 5 ? <View style={styles.dots}>{dots}</View> : null}

        {devCode && step >= 2 && step < 5 ? (
          <GlassCard style={{ marginBottom: 12, borderColor: colors.blue }}>
            <Text style={[styles.simTitle, { color: colors.blue }]}>Simulazione locale</Text>
            <Text style={[styles.sim, { color: colors.text2 }]}>Nessuna email viene inviata offline. Codice generato: <Text style={{ color: colors.text, fontWeight: '800' }}>{devCode}</Text></Text>
          </GlassCard>
        ) : null}

        {err ? <Text style={[styles.err, { color: colors.red }]}>{err}</Text> : null}

        {step === 1 && (
          <>
            <Text style={[styles.h, { color: colors.text }]}>Inserisci la tua email</Text>
            <TextInput style={inp(colors)} placeholder="email@ospedale.it" placeholderTextColor={colors.text3} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <Button title="Invia codice" full onPress={sendCode} disabled={busy} style={{ marginTop: 12 }} />
          </>
        )}
        {step === 2 && (
          <>
            <Text style={[styles.h, { color: colors.text }]}>Inserisci il codice ricevuto</Text>
            <TextInput style={inp(colors)} placeholder="6 cifre" placeholderTextColor={colors.text3} keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
            <Button title="Verifica codice" full onPress={verify} disabled={busy} style={{ marginTop: 12 }} />
            <Button title="Reinvia codice" full variant="ghost" onPress={resend} disabled={busy} style={{ marginTop: 8 }} />
          </>
        )}
        {(step === 3 || step === 4) && (
          <>
            <Text style={[styles.h, { color: colors.text }]}>Imposta una nuova password</Text>
            <TextInput style={inp(colors)} placeholder="Nuova password" placeholderTextColor={colors.text3} secureTextEntry value={pwd} onChangeText={(t) => { setPwd(t); setStep(t ? 4 : 3); }} />
            <TextInput style={[inp(colors), { marginTop: 10 }]} placeholder="Conferma password" placeholderTextColor={colors.text3} secureTextEntry value={pwd2} onChangeText={setPwd2} />
            <Button title="Aggiorna password" full onPress={savePwd} disabled={busy} style={{ marginTop: 12 }} />
          </>
        )}
        {step === 5 && (
          <GlassCard style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={{ fontSize: 40 }}>✅</Text>
            <Text style={[styles.h, { color: colors.text, textAlign: 'center', marginTop: 8 }]}>Password aggiornata</Text>
            <Text style={[styles.sim, { color: colors.text2, textAlign: 'center' }]}>Ora puoi accedere con la nuova password.</Text>
            <Button title="Vai all'accesso" full onPress={() => router.replace('/login')} style={{ marginTop: 16 }} />
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}
const inp = (c: any) => ({ borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: c.text, borderColor: c.separator, backgroundColor: c.card2 });
const styles = StyleSheet.create({
  root: { flex: 1 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 18 },
  dot: { width: 28, height: 6, borderRadius: 3 },
  h: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  err: { fontSize: 13.5, fontWeight: '600', marginBottom: 10 },
  simTitle: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  sim: { fontSize: 13, lineHeight: 19 },
});
