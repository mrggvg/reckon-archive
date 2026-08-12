import { createContext, useContext } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthValue {
  user: AuthUser | null;
  status: 'loading' | 'anon' | 'authed';
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
