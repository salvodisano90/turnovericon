// screens/LoginScreen.tsx — Login definitivo (email/password) sopra useAuth. Provider locale oggi, Supabase domani.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import PressableScale from '../components/PressableScale';
import Icon from '../components/Icon';
import { emailValid } from '../services/authProvider';

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!emailValid(email)) { setErr('Inserisci un indirizzo email valido'); return; }
    if (!pwd) { setErr('Inserisci la password'); return; }
    setBusy(true);
    try {
      const r = await signIn(email, pwd, remember);
      if (r.ok) router.replace('/'); else setErr(r.error || 'Accesso non riuscito');
    } catch { setErr('Errore di connessione. Riprova.'); } finally { setBusy(false); }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Accedi" subtitle="Entra nel tuo reparto" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <GlassCard>
          {err ? <Text style={[styles.err, { color: colors.red }]}>{err}</Text> : null}
          <Text style={[styles.lbl, { color: colors.text3 }]}>Email</Text>
          <TextInput style={inp(colors)} placeholder="email@ospedale.it" placeholderTextColor={colors.text3} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Text style={[styles.lbl, { color: colors.text3, marginTop: 12 }]}>Password</Text>
          <TextInput style={inp(colors)} placeholder="••••••••" placeholderTextColor={colors.text3} secureTextEntry value={pwd} onChangeText={setPwd} />
          <PressableScale onPress={() => setRemember((v) => !v)} style={styles.remember}>
            <View style={[styles.box, { borderColor: remember ? colors.blue : colors.separator, backgroundColor: remember ? colors.blue : 'transparent' }]}>{remember ? <Icon name="checkmark" size={14} color="#fff" /> : null}</View>
            <Text style={[styles.rememberTxt, { color: colors.text2 }]}>Ricordami</Text>
          </PressableScale>
          <Button title="Accedi" full onPress={submit} disabled={busy} style={{ marginTop: 14 }} />
        </GlassCard>
        <Button title="Password dimenticata?" full variant="ghost" onPress={() => router.push('/recupero-password')} style={{ marginTop: 10 }} />
        <Button title="Non hai un account? Registrati" full variant="ghost" onPress={() => router.replace('/registrazione')} style={{ marginTop: 2 }} />
      </ScrollView>
    </View>
  );
}
const inp = (c: any) => ({ borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: c.text, borderColor: c.separator, backgroundColor: c.card2 });
const styles = StyleSheet.create({
  root: { flex: 1 },
  err: { fontSize: 13.5, fontWeight: '600', marginBottom: 10 },
  lbl: { fontSize: 12, marginBottom: 6 },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rememberTxt: { fontSize: 14, fontWeight: '600' },
});
