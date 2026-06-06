// components/Avatar.tsx

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { avatarColor, initials } from '../utils/helpers';

interface Props {
  name: string;
  index: number;
  size?: number;
}

export default function Avatar({ name, index, size = 34 }: Props) {
  return (
    <View
      style={[
        styles.av,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(index) },
      ]}
    >
      <Text style={[styles.txt, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  av: { alignItems: 'center', justifyContent: 'center' },
  txt: { color: '#fff', fontWeight: '700' },
});
