// utils/confirm.ts — conferma azione cross-platform.
// Su React Native Web `Alert.alert` con bottoni non esegue gli onPress:
// qui si usa window.confirm sul web e Alert.alert sul nativo.

import { Alert, Platform } from 'react-native';

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'Elimina',
  destructive = true,
): void {
  if (Platform.OS === 'web') {
    const ok =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`${title}\n\n${message}`)
        : true;
    if (ok) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annulla', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
