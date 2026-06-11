// hooks/useAuth.tsx — Context auth sopra il provider swappabile (oggi LocalAuthProvider).
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth, AuthSession, AuthUser } from '../services/authProvider';

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string, remember: boolean) => Promise<{ ok: boolean; error?: string }>;
  signUp: (d: { nome: string; cognome?: string; email: string; password: string }) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<AuthUser, 'nome' | 'cognome' | 'email'>>) => Promise<{ ok: boolean; error?: string }>;
}

const Ctx = createContext<AuthContextValue | undefined>(undefined);

export function AuthProviderComponent({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => { setSession(await auth.getSession()); }, []);
  useEffect(() => { let m = true; auth.getSession().then((s) => { if (m) { setSession(s); setLoading(false); } }); return () => { m = false; }; }, []);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => { const r = await auth.signIn(email, password, remember); if (r.ok) await refresh(); return r; }, [refresh]);
  const signUp = useCallback(async (d: any) => { const r = await auth.signUp(d); if (r.ok) await refresh(); return r; }, [refresh]);
  const signOut = useCallback(async () => { await auth.signOut(); await refresh(); }, [refresh]);
  const updateProfile = useCallback(async (patch: any) => { const r = await auth.updateProfile(patch); if (r.ok) await refresh(); return r; }, [refresh]);

  return <Ctx.Provider value={{ session, user: session?.user ?? null, loading, refresh, signIn, signUp, signOut, updateProfile }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth deve essere usato dentro AuthProviderComponent');
  return c;
}
