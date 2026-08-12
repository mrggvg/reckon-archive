import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { AuthContext, type AuthUser } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'anon' | 'authed'>('loading');

  // Ask the API who we are; the session cookie does the talking.
  useEffect(() => {
    let cancelled = false;
    api<{ user: AuthUser }>('/api/auth/me')
      .then((res) => {
        if (cancelled) return;
        setUser(res.user);
        setStatus('authed');
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus('anon');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async (path: string, email: string, password: string) => {
    const res = await api<{ user: AuthUser }>(path, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(res.user);
    setStatus('authed');
  }, []);

  const signIn = useCallback(
    (email: string, password: string) => submit('/api/auth/login', email, password),
    [submit],
  );

  const register = useCallback(
    (email: string, password: string) => submit('/api/auth/register', email, password),
    [submit],
  );

  const signOut = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      // Even if the call fails, drop the local session — staying "signed in"
      // against a server that disagrees is worse than signing out twice.
      setUser(null);
      setStatus('anon');
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, signIn, register, signOut }),
    [user, status, signIn, register, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
