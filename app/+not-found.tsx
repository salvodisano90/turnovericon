// app/+not-found.tsx

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTheme } from '../hooks/useTheme';

export default function NotFound() {
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Pagina non trovata' }} />
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>Questa pagina non esiste.</Text>
        <Link href="/" style={[styles.link, { color: colors.blue }]}>
          Torna ai Turni
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  link: { fontSize: 15, fontWeight: '600' },
});
