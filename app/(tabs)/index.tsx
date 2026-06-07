// Home tab: Staff → dashboard personale; Coordinatore → wizard finché non completato, poi calendario turni.
import React, { useEffect, useState } from 'react';
import { useStore } from '../../hooks/useStore';
import TurniScreen from '../../screens/TurniScreen';
import StaffDashboardScreen from '../../screens/StaffDashboardScreen';
import OnboardingScreen from '../../screens/OnboardingScreen';
import { isOnboardingDone } from '../../services/onboardingFlag';

export default function HomeTab() {
  const { role } = useStore();
  const [done, setDone] = useState<boolean | null>(null);
  useEffect(() => { let m = true; isOnboardingDone().then((v) => { if (m) setDone(v); }); return () => { m = false; }; }, []);

  if (role === 'STAFF') return <StaffDashboardScreen />;
  if (done === false) return <OnboardingScreen onDone={() => setDone(true)} />;
  return <TurniScreen />;
}
