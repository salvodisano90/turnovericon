// screens/RegisterScreen.tsx — Registrazione coordinatore (crea account OWNER) sopra useAuth.
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
import { emailValid, passwordIssue } from '../services/authProvider';

export default function RegisterScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [f, setF] = useState({ nome: '', cognome: '', email: '', pwd: '', pwd2: '' });
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const up = (k: string) => (t: string) => setF((s) => ({ ...s, [k]: t }));

  const submit = async () => {
    setErr(null);
    if (!f.nome.trim()) { setErr('Inserisci il nome'); return; }
    if (!emailValid(f.email)) { setErr('Email non valida'); return; }
    const issue = passwordIssue(f.pwd); if (issue) { setErr(issue); return; }
    if (f.pwd !== f.pwd2) { setErr('Le password non coincidono'); return; }
    if (!terms) { setErr('Devi accettare i termini'); return; }
    setBusy(true);
    try {
      const r = await signUp({ nome: f.nome, cognome: f.cognome, email: f.email, password: f.pwd });
      if (r.ok) router.replace('/'); else setErr(r.error || 'Registrazione non riuscita');
    } catch { setErr('Errore di connessione. Riprova.'); } finally { setBusy(false); }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Crea account" subtitle="Registra il tuo profilo coordinatore" onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <GlassCard>
          {err ? <Text style={[styles.err, { color: colors.red }]}>{err}</Text> : null}
          <View style={styles.row2}>
            <View style={{ flex: 1 }}><Text style={[styles.lbl, { color: colors.text3 }]}>Nome</Text><TextInput style={inp(colors)} placeholderTextColor={colors.text3} value={f.nome} onChangeText={up('nome')} /></View>
            <View style={{ flex: 1 }}><Text style={[styles.lbl, { color: colors.text3 }]}>Cognome</Text><TextInput style={inp(colors)} placeholderTextColor={colors.text3} value={f.cognome} onChangeText={up('cognome')} /></View>
          </View>
          <Text style={[styles.lbl, { color: colors.text3, marginTop: 12 }]}>Email</Text>
          <TextInput style={inp(colors)} placeholder="email@ospedale.it" placeholderTextColor={colors.text3} autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={up('email')} />
          <Text style={[styles.lbl, { color: colors.text3, marginTop: 12 }]}>Password</Text>
          <TextInput style={inp(colors)} placeholder="almeno 8 caratteri e un numero" placeholderTextColor={colors.text3} secureTextEntry value={f.pwd} onChangeText={up('pwd')} />
          <Text style={[styles.lbl, { color: colors.text3, marginTop: 12 }]}>Conferma password</Text>
          <TextInput style={inp(colors)} placeholderTextColor={colors.text3} secureTextEntry value={f.pwd2} onChangeText={up('pwd2')} />
          <PressableScale onPress={() => setTerms((v) => !v)} style={styles.terms}>
            <View style={[styles.box, { borderColor: terms ? colors.blue : colors.separator, backgroundColor: terms ? colors.blue : 'transparent' }]}>{terms ? <Icon name="checkmark" size={14} color="#fff" /> : null}</View>
            <Text style={[styles.termsTxt, { color: colors.text2 }]}>Accetto i termini e l'informativa privacy</Text>
          </PressableScale>
          <Button title="Registrati" full onPress={submit} disabled={busy} style={{ marginTop: 14 }} />
        </GlassCard>
        <Button title="Hai già un account? Accedi" full variant="ghost" onPress={() => router.replace('/login')} style={{ marginTop: 10 }} />
      </ScrollView>
    </View>
  );
}
const inp = (c: any) => ({ borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: c.text, borderColor: c.separator, backgroundColor: c.card2 });
const styles = StyleSheet.create({
  root: { flex: 1 },
  err: { fontSize: 13.5, fontWeight: '600', marginBottom: 10 },
  lbl: { fontSize: 12, marginBottom: 6 },
  row2: { flexDirection: 'row', gap: 10 },
  terms: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  termsTxt: { fontSize: 13.5, flex: 1 },
});
