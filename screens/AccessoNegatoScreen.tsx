// screens/AccessoNegatoScreen.tsx — blocco esplicito per route riservate al Coordinatore (mai redirect silenziosi).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { useTheme } from '../hooks/useTheme';

export default function AccessoNegatoScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.dangerSoft || 'rgba(255,69,58,0.16)' }]}>
        <Icon name="lock-closed-outline" size={34} color={colors.red} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Accesso non autorizzato</Text>
      <Text style={[styles.sub, { color: colors.text3 }]}>Questa sezione è riservata al Coordinatore. Il tuo profilo Staff non dispone dei permessi necessari.</Text>
      <Button title="Torna alla mia area" full onPress={() => router.replace('/')} style={{ marginTop: 24, alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 10, lineHeight: 20 },
});
