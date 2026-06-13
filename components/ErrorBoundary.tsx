// components/ErrorBoundary.tsx — evita il blocco a schermo bianco: cattura gli errori di render
// e mostra una schermata di recupero con "Riprova". Self-contained (non dipende dai provider).

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

interface Props { children: React.ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };
  static getDerivedStateFromError(e: unknown): State {
    return { hasError: true, message: e && (e as Error).message ? String((e as Error).message) : 'Errore imprevisto' };
  }
  componentDidCatch() { /* punto di aggancio per logging/telemetria */ }
  reset = () => this.setState({ hasError: false, message: '' });
  render() {
    if (!this.state.hasError) return this.props.children as React.ReactElement;
    return (
      <View style={{ flex: 1, backgroundColor: '#0b0b0c', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>Si è verificato un errore</Text>
        <Text style={{ color: '#B3B3B3', fontSize: 13, textAlign: 'center', marginBottom: 18, lineHeight: 20 }}>L'app non si è bloccata: puoi riprovare. Se il problema persiste, riavvia l'app.</Text>
        <ScrollView style={{ maxHeight: 140, alignSelf: 'stretch', marginBottom: 18 }}><Text style={{ color: '#7A7A7A', fontSize: 12 }}>{this.state.message}</Text></ScrollView>
        <Pressable onPress={this.reset} style={{ backgroundColor: '#2563eb', paddingHorizontal: 26, paddingVertical: 14, borderRadius: 12 }} hitSlop={8}>
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Riprova</Text>
        </Pressable>
      </View>
    );
  }
}
