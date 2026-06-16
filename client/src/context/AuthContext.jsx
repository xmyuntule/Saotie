import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
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

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('haha_token', data.token);
    setUser(data.user);
    setAuthOpen(false);
    return data.user;
  };

  const register = async (payload) => {
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
  const patchUser = (partial) => setUser((u) => (u ? { ...u, ...partial } : u));

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, patchUser, authOpen, setAuthOpen }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
