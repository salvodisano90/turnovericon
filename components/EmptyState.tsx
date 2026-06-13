// components/EmptyState.tsx

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { useTheme } from '../hooks/useTheme';
import Card from './Card';
import Button from './Button';

interface Props {
  icon: string;
  title: string;
  desc: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, desc, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  return (
    <Card style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: colors.blueSoft }]}>
        <Icon name={icon} size={32} color={colors.blue} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.desc, { color: colors.text2 }]}>{desc}</Text>
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          icon={<Icon name="add" size={20} color="#fff" />}
          style={styles.btn}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: 42, paddingHorizontal: 24 },
  iconWrap: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  desc: { fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 300, marginBottom: 18 },
  btn: { paddingHorizontal: 22 },
});
