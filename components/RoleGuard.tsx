// components/RoleGuard.tsx — RBAC reale: blocca l'accesso diretto/deep-link dello STAFF alle route da Coordinatore.
// Mai redirect silenziosi: mostra la schermata "Accesso non autorizzato".
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useStore } from '../hooks/useStore';

const STAFF_ALLOWED = new Set<string>([
  'i-miei-turni', 'richieste', 'desiderata', 'ferie-wizard', 'reperibilita', 'banca-ore',
  'profilo', 'notifiche', 'account-hub', 'sicurezza', 'login', 'registrazione',
  'recupero-password', 'onboarding', 'accesso-negato', '+not-found',
]);
// Dentro (tabs) lo STAFF può stare solo su Dashboard e Account: gli hub Pianificazione/Personale/Controllo sono OWNER.
const STAFF_TABS = new Set<string>(['index', 'account']);

export default function RoleGuard() {
  const { role } = useStore();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (role !== 'STAFF') return;
    const top = segments[0] as string | undefined;
    if (!top) return;
    if (top === '(tabs)') {
      const tab = (segments[1] as string | undefined) || 'index';
      if (!STAFF_TABS.has(tab)) router.replace('/accesso-negato');
      return;
    }
    if (!STAFF_ALLOWED.has(top)) router.replace('/accesso-negato');
  }, [role, segments, router]);
  return null;
}
