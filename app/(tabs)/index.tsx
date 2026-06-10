import React from 'react';
import { useStore } from '../../hooks/useStore';
import DashboardScreen from '../../screens/DashboardScreen';
import StaffDashboardScreen from '../../screens/StaffDashboardScreen';

// Nessun wizard obbligatorio: l'utente configura in qualsiasi ordine dagli hub.
export default function HomeTab() {
  const { role } = useStore();
  if (role === 'STAFF') return <StaffDashboardScreen />;
  return <DashboardScreen />;
}
