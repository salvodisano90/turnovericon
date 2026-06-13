// components/Avatar.tsx — avatar configurabile: iniziali / icona libreria / uomo / donna, colore scelto.
// Fallback: iniziali da nome. Badge ruolo sul bordo. Nessuna immagine esterna.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { DS, initials, ROLE_BADGE, ProfileConfigLite } from '../utils/designSystem';

export default function Avatar({ nome, ruolo, size = 52, config }: { nome: string; ruolo?: string; size?: number; config?: ProfileConfigLite }) {
  const badge = ruolo ? ROLE_BADGE[ruolo] : undefined;
  const hasCfg = !!config;
  const bg = hasCfg ? config!.color : DS.color.card2;
  const glyph = Math.round(size * 0.46);
  let content: React.ReactNode;
  if (config && config.kind === 'emoji' && config.emoji) content = <Text style={{ fontSize: Math.round(size * 0.56) }}>{config.emoji}</Text>;
  else if (config && config.kind === 'icon' && config.icon) content = <Icon name={config.icon as any} size={glyph} color="#fff" />;
  else if (config && (config.kind === 'man' || config.kind === 'woman')) content = <Icon name={config.kind as any} size={glyph} color="#fff" />;
  else content = <Text style={[styles.txt, { fontSize: Math.round(size * 0.38), color: hasCfg ? '#fff' : DS.color.text }]}>{((config && config.initials) || initials(nome)).slice(0, 2)}</Text>;
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>{content}</View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: badge.color, borderColor: DS.color.bg }]}>
          <Text style={styles.badgeTxt}>{badge.label}</Text>
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: DS.color.border },
  txt: { fontWeight: '800' },
  badge: { position: 'absolute', right: -2, bottom: -2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#06101C', fontSize: 11, fontWeight: '900' },
});
