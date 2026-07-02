import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosError } from 'axios';

const api: AxiosInstance = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('haha_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
