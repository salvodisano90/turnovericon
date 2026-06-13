// components/AuthGate.tsx — FASE 1 (round 2): redirect + OVERLAY bloccante.
// Garanzia "zero frame protetti": finché lo stato non è (idratato E deciso E coerente con la rotta),
// un pannello opaco copre i contenuti. Nessun render temporaneo di Dashboard/Piano/Personale/Controllo/Account.
import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';

const AUTH_ROUTES = new Set<string>(['login', 'registrazione', 'recupero-password', 'onboarding', '+not-found']);

export default function AuthGate() {
  const { session, loading } = useAuth();
  const { role, currentEmail, hydrated } = useStore();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  const top = (segments[0] as string | undefined) || '';
  const onAuthRoute = AUTH_ROUTES.has(top);
  const authenticated = !!session || (role === 'STAFF' && !!currentEmail);
  const ready = !loading && hydrated;

  useEffect(() => {
    if (!ready) return;
    if (!authenticated && !onAuthRoute) router.replace('/login');
    else if (authenticated && top === 'login') router.replace('/');
  }, [ready, authenticated, onAuthRoute, top, router]);

  // Copri il contenuto quando: non pronti (cold start/hydration), OPPURE non autenticati ma non ancora
  // sulla schermata di auth (il frame prima del redirect). Mai coprire le schermate di auth stesse.
  const cover = !onAuthRoute && (!ready || !authenticated);
  if (!cover) return null;
  return <View pointerEvents="auto" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, zIndex: 9999 }} />;
}
