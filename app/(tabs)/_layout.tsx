// app/(tabs)/_layout.tsx — bottom tab navigator.
// Lo STAFF vede solo la Home (dashboard personale): le tab del coordinatore sono ASSENTI (href:null), non disabilitate.

import React from 'react';
import { Tabs } from 'expo-router';
import Icon from '../../components/Icon';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { role } = useStore();
  const isStaff = role === 'STAFF';
  const coordOnly = isStaff ? { href: null as any } : {};
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.separator },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: isStaff ? 'Home' : 'Turni', tabBarIcon: ({ color, size }) => <Icon name={isStaff ? 'home' : 'calendar'} size={size} color={color} /> }}
      />
      <Tabs.Screen name="copertura" options={{ title: 'Copertura', tabBarIcon: ({ color, size }) => <Icon name="pulse" size={size} color={color} />, ...coordOnly }} />
      <Tabs.Screen name="personale" options={{ title: 'Staff', tabBarIcon: ({ color, size }) => <Icon name="people" size={size} color={color} />, ...coordOnly }} />
      <Tabs.Screen name="reparti" options={{ title: 'Reparti', tabBarIcon: ({ color, size }) => <Icon name="business" size={size} color={color} />, ...coordOnly }} />
      <Tabs.Screen name="report" options={{ title: 'Report', tabBarIcon: ({ color, size }) => <Icon name="stats-chart" size={size} color={color} />, ...coordOnly }} />
    </Tabs>
  );
}
