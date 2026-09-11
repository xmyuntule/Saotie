import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import api from '../api/client';

const UnreadContext = createContext({ notif: 0, msg: 0 });
export function UnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [counts, setCounts] = useState({ notif: 0, msg: 0 });
  useEffect(() => {
    let alive = true;
    let busy = false;
    setCounts({ notif: 0, msg: 0 });
    if (!user) return;
    const refresh = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const [n, m] = await Promise.all([api.get('/notifications/unread'), api.get('/messages/unread')]);
        if (alive) setCounts({ notif: n.data.unread, msg: m.data.unread });
      } catch { /* Keep the previous counts when temporarily offline. */ }
      finally { busy = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { alive = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [user?.id, pathname]);
  return <UnreadContext.Provider value={user ? counts : { notif: 0, msg: 0 }}>{children}</UnreadContext.Provider>;
}
export const useUnread = () => useContext(UnreadContext);
