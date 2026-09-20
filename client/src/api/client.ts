import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosError } from 'axios';

const api: AxiosInstance = axios.create({ baseURL: '/api' });
const VISITOR_KEY = 'saotie_visitor_id';

function postUnlockToken(url?: string) {
  const match = String(url || '').match(/\/posts\/(\d+)(?:\/|$)/);
  if (!match) return '';
  try {
    return sessionStorage.getItem(`saotie_post_unlock_${match[1]}`) || '';
  } catch {
    return '';
  }
}

function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID?.() || `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('haha_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const unlock = postUnlockToken(config.url);
  if (unlock) config.headers['X-Post-Unlock-Token'] = unlock;
  const visitor = visitorId();
  if (visitor) config.headers['X-Saotie-Visitor'] = visitor;
  return config;
});

// Surface a clean, user-facing error message
api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ error?: string }>) => {
    const msg = err.response?.data?.error || err.message || '网络开小差了，请稍后重试';
    return Promise.reject(new Error(msg));
  },
);

export default api;
