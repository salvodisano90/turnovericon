// components/RoleGuard.tsx — RBAC reale: blocca l'accesso diretto/deep-link degli OPERATORI (STAFF) alle route da coordinatore.
// Non duplica logica: legge role dallo store e i segmenti di navigazione; reindirizza a '/'.
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useStore } from '../hooks/useStore';

const STAFF_ALLOWED = new Set<string>([
  '(tabs)', 'i-miei-turni', 'richieste', 'desiderata', 'ferie-wizard', 'reperibilita',
  'profilo', 'notifiche', 'account-hub', 'sicurezza', 'login', 'registrazione',
  'recupero-password', 'onboarding', '+not-found',
]);

export default function RoleGuard() {
  const { role } = useStore();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (role !== 'STAFF') return;
    const top = segments[0] as string | undefined;
    if (top && !STAFF_ALLOWED.has(top)) router.replace('/');
  }, [role, segments, router]);
  return null;
}
