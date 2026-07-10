import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  init: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const userStr = await SecureStore.getItemAsync('auth_user');
      if (token && userStr) {
        set({ token, user: JSON.parse(userStr), isAuthenticated: true });
      }
    } catch (e) {
      console.error('Auth init error:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  updateUser: (updates) => {
    const updated = { ...get().user, ...updates };
    SecureStore.setItemAsync('auth_user', JSON.stringify(updated));
    set({ user: updated });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
