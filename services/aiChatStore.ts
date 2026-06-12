// services/aiChatStore.ts — persistenza conversazioni AI (pattern reperibilitaOp). UI futura; nessun modello esterno.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIConversation } from './ai';
const KEY = 'turnover.ai_conversations';
export async function loadConversations(): Promise<AIConversation[]> {
  try { const raw = await AsyncStorage.getItem(KEY); if (!raw) return []; const d = JSON.parse(raw); return Array.isArray(d) ? d : []; } catch { return []; }
}
export async function saveConversations(list: AIConversation[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(Array.isArray(list) ? list : [])); } catch { /* no-op */ }
}
