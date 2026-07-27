import { create } from 'zustand';
import api from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  role: 'OWNER' | 'CASHIER' | 'SUPER_ADMIN';
  status?: string;
  hasPassword?: boolean;
  phoneVerified?: boolean;
  storeId?: string | null;
  impersonatedBy?: string | null;
}

interface StoreItem {
  id: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  stores: StoreItem[];
  currentStoreId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialize: () => void;
  login: (user: User, token: string, stores?: StoreItem[]) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  switchStore: (storeId: string) => void;
}

let inactivityTimeout: NodeJS.Timeout | null = null;
let cleanupInactivityTracking: (() => void) | null = null;

const startInactivityTracking = (logoutFn: () => void) => {
  if (typeof window === 'undefined') return null;

  const resetTimer = () => {
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => {
      console.log('[AuthStore] Auto logging out due to inactivity');
      logoutFn();
    }, 30 * 60 * 1000); // 30 minutes
  };

  const events = ['mousemove', 'keypress', 'mousedown', 'scroll', 'touchstart'];
  events.forEach(evt => window.addEventListener(evt, resetTimer));

  resetTimer();

  return () => {
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    events.forEach(evt => window.removeEventListener(evt, resetTimer));
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  stores: [],
  currentStoreId: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: () => {
    if (typeof window === 'undefined') return;
    
    const token = localStorage.getItem('kasirmu_token');
    const userStr = localStorage.getItem('kasirmu_user');
    const storesStr = localStorage.getItem('kasirmu_stores');
    const currentStoreId = localStorage.getItem('kasirmu_current_store_id');

    if (token && userStr) {
      const user = JSON.parse(userStr) as User;
      const stores = storesStr ? JSON.parse(storesStr) : [];
      set({
        token,
        user,
        stores,
        currentStoreId: currentStoreId || user.storeId || (stores.length > 0 ? stores[0].id : null),
        isAuthenticated: true,
        isLoading: false,
      });
      api.setToken(token);

      // Start inactivity tracking for Cashier
      if (user.role === 'CASHIER') {
        cleanupInactivityTracking?.();
        const cleanup = startInactivityTracking(() => get().logout());
        if (cleanup) cleanupInactivityTracking = cleanup;
      }
    } else {
      set({ isLoading: false });
    }
  },

  login: (user, token, stores = []) => {
    const activeStoreId = user.storeId || (stores.length > 0 ? stores[0].id : null);
    
    localStorage.setItem('kasirmu_token', token);
    localStorage.setItem('kasirmu_user', JSON.stringify(user));
    localStorage.setItem('kasirmu_stores', JSON.stringify(stores));
    if (activeStoreId) {
      localStorage.setItem('kasirmu_current_store_id', activeStoreId);
    }

    set({
      user,
      token,
      stores,
      currentStoreId: activeStoreId,
      isAuthenticated: true,
    });
    api.setToken(token);

    // Start inactivity tracking for Cashier
    if (user.role === 'CASHIER') {
      cleanupInactivityTracking?.();
      const cleanup = startInactivityTracking(() => get().logout());
      if (cleanup) cleanupInactivityTracking = cleanup;
    }
  },

  logout: () => {
    cleanupInactivityTracking?.();
    cleanupInactivityTracking = null;

    localStorage.removeItem('kasirmu_token');
    localStorage.removeItem('kasirmu_user');
    localStorage.removeItem('kasirmu_stores');
    localStorage.removeItem('kasirmu_current_store_id');
    
    // Call server logout to revoke session
    api.post('/sessions/logout', {}).catch(() => {});

    set({
      user: null,
      token: null,
      stores: [],
      currentStoreId: null,
      isAuthenticated: false,
    });
    api.clearToken();
  },

  updateUser: (updatedFields: Partial<User>) => {
    const { user } = get();
    if (!user) return;
    
    const updatedUser = { ...user, ...updatedFields };
    localStorage.setItem('kasirmu_user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  switchStore: (storeId) => {
    const { user } = get();
    if (!user) return;

    localStorage.setItem('kasirmu_current_store_id', storeId);
    set({ currentStoreId: storeId });
    
    // For cashiers, storeId is updated in their user profile
    if (user.role === 'CASHIER') {
      const updatedUser = { ...user, storeId };
      localStorage.setItem('kasirmu_user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
    }
  },
}));
