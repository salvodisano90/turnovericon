// utils/contextMenu.ts — menu contestuale stile iOS (ActionSheet nativo, fallback Alert). Nessuna dipendenza.
import { ActionSheetIOS, Alert, Platform } from 'react-native';

export interface MenuAction { label: string; destructive?: boolean; onPress: () => void; }

export function showContextMenu(title: string, actions: MenuAction[]) {
  if (Platform.OS === 'ios' && ActionSheetIOS && typeof ActionSheetIOS.showActionSheetWithOptions === 'function') {
    const di = actions.findIndex((a) => a.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...actions.map((a) => a.label), 'Annulla'], cancelButtonIndex: actions.length, destructiveButtonIndex: di >= 0 ? di : undefined },
      (i) => { if (i >= 0 && i < actions.length) actions[i].onPress(); }
    );
  } else {
    Alert.alert(title, undefined, [
      ...actions.map((a) => ({ text: a.label, style: (a.destructive ? 'destructive' : 'default') as 'destructive' | 'default', onPress: a.onPress })),
      { text: 'Annulla', style: 'cancel' as const },
    ]);
  }
}
