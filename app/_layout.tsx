// app/_layout.tsx — root layout: providers + navigation stack

import 'react-native-gesture-handler';
import React from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { StoreProvider } from '../hooks/useStore';
import { ToastProvider } from '../hooks/useToast';

function RootNavigator() {
  const { colors, mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="reparto-wizard" options={{ presentation: 'modal' }} />
        <Stack.Screen name="staff-wizard" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ferie-wizard" options={{ presentation: 'modal' }} />
        <Stack.Screen name="cell-editor" options={{ presentation: 'modal' }} />
        <Stack.Screen name="staff-detail" options={{ presentation: 'modal' }} />
        <Stack.Screen name="strumenti" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sostituzioni" options={{ presentation: 'modal' }} />
        <Stack.Screen name="desiderata" options={{ presentation: 'modal' }} />
        <Stack.Screen name="impostazioni" options={{ presentation: 'modal' }} />
        <Stack.Screen name="matrici" options={{ presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StoreProvider>
            <ToastProvider>
              <RootNavigator />
            </ToastProvider>
          </StoreProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
