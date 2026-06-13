// screens/LoginScreen.tsx — Login definitivo (email/password) sopra useAuth. Provider locale oggi, Supabase domani.
import React, { useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { GLASS } from '../utils/designSystem';
import { useAuth } from '../hooks/useAuth';
import { useStore } from '../hooks/useStore';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import PressableScale from '../components/PressableScale';
import Icon from '../components/Icon';
import { emailValid } from '../services/authProvider';
import { loadStaffCreds, saveStaffCreds } from '../services/staffCredentials';
import { verifyStaffPassword } from '../utils/staffAuth';

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const { loginAsStaff, loginAsOwner } = useStore();
  const [mode, setMode] = useState<'manager' | 'staff'>('manager');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [remember] = useState(true); // sessione persistente di default (FASE 6)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!emailValid(email)) { setErr('Inserisci un indirizzo email valido'); return; }
    if (mode === 'staff') {
      if (!pwd) { setErr('Inserisci la password'); return; }
      setBusy(true);
      try {
        const creds = await loadStaffCreds();
        const v = verifyStaffPassword(creds, email, pwd, Date.now());
        await saveStaffCreds(v.creds);
        if (!v.ok) { setErr(v.error || 'Credenziali non valide.'); return; }
        const r = loginAsStaff(email);
        if (!r.ok) { setErr(r.error || 'Accesso non autorizzato.'); return; }
        router.replace('/');
      } finally { setBusy(false); }
      return;
    }
    if (!pwd) { setErr('Inserisci la password'); return; }
    setBusy(true);
    try {
      const r = await signIn(email, pwd, remember);
      if (r.ok) { loginAsOwner(email); router.replace('/'); } else setErr(r.error || 'Accesso non riuscito');
    } catch { setErr('Errore di connessione. Riprova.'); } finally { setBusy(false); }
  };

  // Segmented iOS: pillola che scorre con spring (FASE 2)
  const segX = React.useRef(new Animated.Value(0)).current;
  const [segW, setSegW] = React.useState(0);
  React.useEffect(() => {
    Animated.spring(segX, { toValue: mode === 'manager' ? 0 : segW / 2, damping: 18, stiffness: 260, mass: 0.7, useNativeDriver: true }).start();
  }, [mode, segW, segX]);

  const field = (label: string, node: React.ReactNode) => (
    <View style={{ marginBottom: 24 }}>
      <Text style={[styles.fieldLabel, { color: colors.text2 }]}>{label}</Text>
      {node}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 32, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Logo · Titolo · Sottotitolo */}
        <View style={styles.brand}>
          <View style={[styles.logo, { borderColor: GLASS.border }]}>
            <Icon name="pulse" size={30} color={colors.text} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>TURNOVER</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>Gestione intelligente della turnistica sanitaria</Text>
        </View>

        {/* Ruolo — segmented con pillola spring */}
        <View style={[styles.segment, { borderColor: GLASS.border }]} onLayout={(e) => setSegW(e.nativeEvent.layout.width - 8)}>
          <Animated.View pointerEvents="none" style={[styles.segPill, { width: segW / 2, transform: [{ translateX: segX }] }]} />
          {(([['manager', 'Manager'], ['staff', 'Staff']]) as Array<['manager' | 'staff', string]>).map(([mv, ml]) => (
            <Pressable key={mv} style={styles.segOpt} onPress={() => setMode(mv)}>
              <Text style={[styles.segTxt, { color: mode === mv ? colors.text : colors.text3 }]}>{ml}</Text>
            </Pressable>
          ))}
        </View>

        {field('Email', (
          <TextInput style={[styles.input, { color: colors.text, borderColor: GLASS.border }]} placeholder="nome@ospedale.it" placeholderTextColor={colors.text3} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setEmail} />
        ))}
        {field('Password', (
          <TextInput style={[styles.input, { color: colors.text, borderColor: GLASS.border }]} placeholder="••••••••" placeholderTextColor={colors.text3} secureTextEntry value={pwd} onChangeText={setPwd} />
        ))}

        {err ? <Text style={[styles.err, { color: colors.red }]}>{err}</Text> : null}

        <PressableScale onPress={busy ? undefined : submit} scaleTo={0.97} durIn={140} durOut={140}>
          <View style={[styles.cta, { backgroundColor: colors.text, opacity: busy ? 0.6 : 1 }]}>
            <Text style={[styles.ctaTxt, { color: colors.bg }]}>{busy ? 'Accesso…' : 'Accedi'}</Text>
          </View>
        </PressableScale>

        <Pressable onPress={() => router.push('/recupero-password')} style={{ marginTop: 24, alignSelf: 'center' }} hitSlop={8}>
          <Text style={[styles.link, { color: colors.text2 }]}>Password dimenticata?</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/registrazione')} style={{ marginTop: 16, alignSelf: 'center' }} hitSlop={8}>
          <Text style={[styles.link, { color: colors.text3 }]}>Non hai un account? <Text style={{ color: colors.text }}>Registrati</Text></Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  brand: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 72, height: 72, borderRadius: 22, borderWidth: 1, backgroundColor: GLASS.background, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: 1 },
  subtitle: { fontSize: 15, fontWeight: '400', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  segment: { flexDirection: 'row', height: 48, borderRadius: 16, borderWidth: 1, backgroundColor: GLASS.background, padding: 4, marginBottom: 24 },
  segPill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)' },
  segOpt: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segTxt: { fontSize: 15, fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  input: { height: 56, borderRadius: 18, borderWidth: 1, backgroundColor: GLASS.background, paddingHorizontal: 16, fontSize: 15 },
  err: { fontSize: 13, fontWeight: '500', marginBottom: 16, textAlign: 'center' },
  cta: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ctaTxt: { fontSize: 17, fontWeight: '700' },
  link: { fontSize: 15, fontWeight: '500' },
});
