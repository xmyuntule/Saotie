import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('haha_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Surface a clean error message
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err.response?.data?.error || err.message || '网络异常';
    return Promise.reject(new Error(msg));
  }
);

export default api;
