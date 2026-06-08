// app/(tabs)/_layout.tsx — 5 tab con bottom navigation flottante custom (no tab Expo standard).
import React from 'react';
import { Tabs } from 'expo-router';
import { useStore } from '../../hooks/useStore';
import FloatingBottomNavigation from '../../components/FloatingBottomNavigation';

export default function TabsLayout() {
  const { role } = useStore();
  const coordOnly = role === 'STAFF' ? { href: null as any } : {};
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingBottomNavigation {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="pianificazione" options={coordOnly} />
      <Tabs.Screen name="personale" options={coordOnly} />
      <Tabs.Screen name="controllo" options={coordOnly} />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
