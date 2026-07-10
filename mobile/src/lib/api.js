import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const BASE_URL = __DEV__
  ? "http://192.168.0.63:4000/api" // change to your local IP
  : "https://api.eldercare.in/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async config => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('auth_user');
      // Navigation handled at screen level via auth store
    }
    return Promise.reject(err);
  }
);

export default api;
