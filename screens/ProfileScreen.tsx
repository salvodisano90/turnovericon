// screens/ProfileScreen.tsx — pannello profilo accessibile dall'avatar.
// Profilo (avatar, nome, ruolo, stato login) + personalizzazione (colore, iniziali, uomo/donna, icone locali).

import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import SheetHeader from '../components/SheetHeader';
import GlassCard from '../components/GlassCard';
import PressableScale from '../components/PressableScale';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import SectionTitle from '../components/SectionTitle';
import { backend } from '../services/backend';
import { AVATAR_COLORS, AVATAR_LIBRARY } from '../utils/designSystem';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, setProfile, role, members } = useStore();

  const roleLabel = role === 'STAFF' ? 'Staff' : 'Coordinatore';
  const avatarRole = role === 'STAFF' ? 'Infermiere' : 'Coordinatore';
  const me = (members || []).find((m) => (role === 'STAFF' ? m.ruolo === 'STAFF' : m.ruolo === 'OWNER')) || (members || [])[0];
  const displayName = me && me.nome ? me.nome : roleLabel;
  const connected = backend.auth.isBackendConnected();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SheetHeader title="Profilo" subtitle="Account e personalizzazione" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>

        <GlassCard style={styles.profileCard}>
          <Avatar nome={displayName} ruolo={avatarRole} size={72} config={profile} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.role, { color: colors.text2 }]}>{roleLabel}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: connected ? colors.green : colors.text3 }]} />
              <Text style={[styles.status, { color: colors.text3 }]}>{connected ? 'Connesso' : 'Offline (non connesso)'}</Text>
            </View>
          </View>
        </GlassCard>

        <Button title={connected ? 'Gestisci accesso' : 'Accedi / Esci'} full icon="log-in-outline" onPress={() => router.push('/login')} style={{ marginTop: 12 }} />

        <SectionTitle>Colore avatar</SectionTitle>
        <GlassCard>
          <View style={styles.swatches}>
            {AVATAR_COLORS.map((c) => {
              const on = profile.color === c;
              return (
                <PressableScale key={c} onPress={() => setProfile({ color: c })}>
                  <View style={[styles.swatch, { backgroundColor: c, borderColor: on ? colors.text : 'transparent', borderWidth: on ? 3 : 0 }]}>
                    {on ? <Icon name="checkmark" size={16} color="#fff" /> : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </GlassCard>

        <SectionTitle>Iniziali personalizzate</SectionTitle>
        <GlassCard>
          <View style={styles.initRow}>
            <TextInput
              style={[styles.initInput, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.card2 }]}
              placeholder="es. SD" placeholderTextColor={colors.text3} autoCapitalize="characters" maxLength={2}
              value={profile.kind === 'initials' ? (profile.initials || '') : ''}
              onChangeText={(t) => setProfile({ kind: 'initials', initials: t.toUpperCase().slice(0, 2) })}
            />
            <Text style={[styles.hint, { color: colors.text3 }]}>Massimo 2 lettere. Lascia vuoto per usare le iniziali del nome.</Text>
          </View>
        </GlassCard>

        <SectionTitle>Avatar predefinito</SectionTitle>
        <GlassCard>
          <View style={styles.genderRow}>
            <PressableScale onPress={() => setProfile({ kind: 'man' })} style={styles.genderWrap}>
              <View style={[styles.gender, { backgroundColor: profile.kind === 'man' ? colors.blueSoft : colors.card2, borderColor: profile.kind === 'man' ? colors.blue : colors.separator }]}>
                <Icon name="man" size={26} color={profile.kind === 'man' ? colors.blue : colors.text2} />
                <Text style={[styles.genderTxt, { color: profile.kind === 'man' ? colors.blue : colors.text2 }]}>Uomo</Text>
              </View>
            </PressableScale>
            <PressableScale onPress={() => setProfile({ kind: 'woman' })} style={styles.genderWrap}>
              <View style={[styles.gender, { backgroundColor: profile.kind === 'woman' ? colors.blueSoft : colors.card2, borderColor: profile.kind === 'woman' ? colors.blue : colors.separator }]}>
                <Icon name="woman" size={26} color={profile.kind === 'woman' ? colors.blue : colors.text2} />
                <Text style={[styles.genderTxt, { color: profile.kind === 'woman' ? colors.blue : colors.text2 }]}>Donna</Text>
              </View>
            </PressableScale>
          </View>
        </GlassCard>

        {AVATAR_LIBRARY.map((cat) => (
          <View key={cat.category}>
            <SectionTitle>{cat.category}</SectionTitle>
            <View style={styles.iconGrid}>
              {cat.items.map((ic) => {
                const on = ic.emoji ? (profile.kind === 'emoji' && profile.emoji === ic.emoji) : (profile.kind === 'icon' && profile.icon === ic.icon);
                return (
                  <PressableScale key={ic.key} onPress={() => setProfile(ic.emoji ? { kind: 'emoji', emoji: ic.emoji, icon: undefined } : { kind: 'icon', icon: ic.icon, emoji: undefined })} style={styles.iconWrap}>
                    <View style={[styles.iconCell, { backgroundColor: on ? colors.blueSoft : colors.card2, borderColor: on ? colors.blue : colors.separator }]}>
                      {ic.emoji ? <Text style={{ fontSize: 24 }}>{ic.emoji}</Text> : <Icon name={ic.icon as any} size={22} color={on ? colors.blue : colors.text2} />}
                    </View>
                    <Text style={[styles.iconLbl, { color: colors.text3 }]} numberOfLines={1}>{ic.label}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { fontSize: 20, fontWeight: '800' },
  role: { fontSize: 14, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 12.5 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initRow: { gap: 8 },
  initInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 20, fontWeight: '800', borderWidth: 1, width: 90, textAlign: 'center', letterSpacing: 2 },
  hint: { fontSize: 12.5, lineHeight: 18 },
  genderRow: { flexDirection: 'row', gap: 12 },
  genderWrap: { flex: 1 },
  gender: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 14, borderWidth: 1 },
  genderTxt: { fontSize: 15, fontWeight: '700' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  iconWrap: { width: '21%', alignItems: 'center', gap: 5 },
  iconCell: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconLbl: { fontSize: 10.5 },
});
