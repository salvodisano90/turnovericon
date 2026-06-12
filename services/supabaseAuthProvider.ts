import { supabase } from '../integrations/supabaseClient';
import {
  AuthProvider,
  AuthSession,
  AuthUser,
} from './authProvider';

function mapUser(user: any): AuthUser {
  return {
    id: user.id,
    email: user.email || '',
    nome: user.user_metadata?.nome || 'Utente',
    cognome: user.user_metadata?.cognome,
    role: 'OWNER',
  };
}

export const SupabaseAuthProvider: AuthProvider = {
  async getSession(): Promise<AuthSession | null> {
    const { data } = await supabase.auth.getSession();

    if (!data.session) return null;

    return {
      user: mapUser(data.session.user),
      token: data.session.access_token,
      remember: true,
    };
  },

  async signUp(d) {
    const { error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        data: {
          nome: d.nome,
          cognome: d.cognome,
        },
      },
    });

    if (error) return { ok: false, error: error.message };

    return { ok: true };
  },

  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { ok: false, error: error.message };

    return { ok: true };
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async requestPasswordReset(email) {
    const { error } =
      await supabase.auth.resetPasswordForEmail(email);

    return { ok: !error };
  },

  async verifyCode() {
    return { ok: false };
  },

  async setNewPassword() {
    return {
      ok: false,
      error: 'Non implementato',
    };
  },

  async resendCode() {
    return { ok: false };
  },

  async signInWithOtp(email) {
    const { error } =
      await supabase.auth.signInWithOtp({ email });

    return {
      ok: !error,
      error: error?.message,
    };
  },

  async updateProfile(patch) {
    const { error } =
      await supabase.auth.updateUser({
        data: patch,
      });

    if (error)
      return {
        ok: false,
        error: error.message,
      };

    return { ok: true };
  },
};
