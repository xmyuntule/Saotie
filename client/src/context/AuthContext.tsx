import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import api from '../api/client';
import type { PublicUser } from '../types';

export interface AuthValue {
  user: PublicUser | null;
  loading: boolean;
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  login: (username: string, password: string) => Promise<PublicUser>;
  register: (payload: Record<string, unknown>) => Promise<PublicUser>;
  logout: () => void;
  refresh: () => Promise<void>;
  patchUser: (partial: Partial<PublicUser>) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children?: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false); // login/register modal

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('haha_token');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
    } catch {
      localStorage.removeItem('haha_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (username: string, password: string): Promise<PublicUser> => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('haha_token', data.token);
    setUser(data.user);
    setAuthOpen(false);
    return data.user;
  };

  const register = async (payload: Record<string, unknown>): Promise<PublicUser> => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('haha_token', data.token);
    setUser(data.user);
    setAuthOpen(false);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('haha_token');
    setUser(null);
  };

  // Merge partial updates from server responses (points, level, etc.)
  const patchUser = (partial: Partial<PublicUser>) => setUser((u) => (u ? { ...u, ...partial } : u));

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, patchUser, authOpen, setAuthOpen }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthValue => useContext(AuthContext) as AuthValue;
