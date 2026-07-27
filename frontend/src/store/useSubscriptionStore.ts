'use client';

import { create } from 'zustand';
import api from '../lib/api';

// ──────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  features: string;
  durationDays: number;
  isActive: boolean;
  // Limits
  maxStore: number;
  maxProduct: number;
  maxCashier: number;
  maxCategory: number;
  // Feature flags
  canUseMidtrans: boolean;
  canUseQRIS: boolean;
  canUseExport: boolean;
  canUseAnalytics: boolean;
  canUseAPI: boolean;
  canUseAI: boolean;
  canUseMultiBranch: boolean;
  canUseLoyalty: boolean;
  canUsePromo: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string; // 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' | 'CANCELLED' | 'PENDING_PAYMENT'
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  gracePeriodUntil: string | null;
  createdAt: string;
}

export interface UsageStats {
  stores: number;
  products: number;
  cashiers: number;
  categories: number;
}

export interface CheckoutResult {
  snapToken: string;
  paymentUrl: string;
  orderId: string;
  clientKey: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  simulatorMode: boolean;
}

interface SubscriptionState {
  subscription: Subscription | null;
  plan: SubscriptionPlan | null;
  isPremium: boolean;
  isGracePeriod: boolean;
  gracePeriodUntil: string | null;
  usage: UsageStats;
  isLoading: boolean;
  isInitialized: boolean;
  canClaimTrial: boolean;
  trialClaim: any | null;

  fetchSubscription: () => Promise<void>;
  claimTrial: (nik: string) => Promise<any>;
  checkout: (planId: string) => Promise<CheckoutResult>;
  updateFromSocket: (data: { planName?: string; endDate?: string; message?: string; isPremium?: boolean; isGracePeriod?: boolean }) => void;
  updateFromGracePeriodSocket: (data: { isGracePeriod: boolean; gracePeriodUntil?: string; message?: string }) => void;
  canUse: (feature: keyof Pick<SubscriptionPlan,
    'canUseMidtrans' | 'canUseQRIS' | 'canUseExport' | 'canUseAnalytics' |
    'canUseAPI' | 'canUseAI' | 'canUseMultiBranch' | 'canUseLoyalty' | 'canUsePromo'
  >) => boolean;
  isAtLimit: (resource: 'stores' | 'products' | 'cashiers' | 'categories') => boolean;
  getUsagePercent: (resource: 'stores' | 'products' | 'cashiers' | 'categories') => number;
  getMax: (resource: 'stores' | 'products' | 'cashiers' | 'categories') => number;
  reset: () => void;
}

const planResourceMap: Record<string, keyof SubscriptionPlan> = {
  stores: 'maxStore',
  products: 'maxProduct',
  cashiers: 'maxCashier',
  categories: 'maxCategory',
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscription: null,
  plan: null,
  isPremium: false,
  isGracePeriod: false,
  gracePeriodUntil: null,
  usage: { stores: 0, products: 0, cashiers: 0, categories: 0 },
  isLoading: false,
  isInitialized: false,
  canClaimTrial: false,
  trialClaim: null,

  fetchSubscription: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/subscriptions/my');
      const plan = res.plan;
      // Support both 'PRO' and 'PREMIUM'/'PREMIUM TRIAL' plan names
      const isPremium =
        res.isPremium ??
        ((plan?.name === 'PRO' || plan?.name === 'PREMIUM' || plan?.name === 'PREMIUM TRIAL') && res.subscription?.status === 'ACTIVE');

      const isGracePeriod = res.isGracePeriod ?? (res.subscription?.status === 'GRACE_PERIOD');

      set({
        subscription: res.subscription,
        plan,
        isPremium,
        isGracePeriod,
        gracePeriodUntil: res.gracePeriodUntil ?? res.subscription?.gracePeriodUntil ?? null,
        usage: res.usage ?? { stores: 0, products: 0, cashiers: 0, categories: 0 },
        canClaimTrial: res.canClaimTrial ?? false,
        trialClaim: res.trialClaim ?? null,
        isInitialized: true,
      });
    } catch (err) {
      console.error('[SubscriptionStore] Failed to fetch subscription:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  claimTrial: async (nik: string) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/subscriptions/trial/claim', { nik });
      await get().fetchSubscription();
      return res;
    } catch (err) {
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  // Checkout: create Midtrans Snap token for a given plan
  checkout: async (planId: string): Promise<CheckoutResult> => {
    const res = await api.post('/subscriptions/checkout', { planId });
    return res as CheckoutResult;
  },

  // updateFromSocket: called when Socket.IO emits subscription_upgraded
  // Immediately refreshes subscription data from server
  updateFromSocket: (_data) => {
    // Trigger a fresh fetch to get the real updated subscription state from backend
    get().fetchSubscription();
  },

  // updateFromGracePeriodSocket: called when Socket.IO emits subscription_grace_period
  updateFromGracePeriodSocket: (_data) => {
    // Trigger a fresh fetch to sync state
    get().fetchSubscription();
  },

  canUse: (feature) => {
    const { plan, isGracePeriod } = get();
    if (!plan) return false;
    // During grace period, premium features are blocked
    if (isGracePeriod) return false;
    return plan[feature] as boolean;
  },

  isAtLimit: (resource) => {
    const { plan, usage, isGracePeriod } = get();
    if (!plan) return true;

    // During grace period, enforce FREE limits
    if (isGracePeriod) {
      const freeLimits: Record<string, number> = {
        stores: 1,
        products: 5,
        cashiers: 3,
        categories: 2,
      };
      const max = freeLimits[resource] ?? 0;
      return (usage[resource] ?? 0) >= max;
    }

    const maxKey = planResourceMap[resource] as keyof SubscriptionPlan;
    const max = plan[maxKey] as number;
    if (max === -1) return false; // unlimited
    return (usage[resource] ?? 0) >= max;
  },

  getUsagePercent: (resource) => {
    const { plan, usage } = get();
    if (!plan) return 100;
    const maxKey = planResourceMap[resource] as keyof SubscriptionPlan;
    const max = plan[maxKey] as number;
    if (max === -1) return (usage[resource] > 0 ? 10 : 0); // show small fill for unlimited
    if (max === 0) return 100;
    return Math.min(100, Math.round(((usage[resource] ?? 0) / max) * 100));
  },

  getMax: (resource) => {
    const { plan } = get();
    if (!plan) return 0;
    const maxKey = planResourceMap[resource] as keyof SubscriptionPlan;
    return plan[maxKey] as number;
  },

  reset: () => {
    set({
      subscription: null,
      plan: null,
      isPremium: false,
      isGracePeriod: false,
      gracePeriodUntil: null,
      usage: { stores: 0, products: 0, cashiers: 0, categories: 0 },
      isInitialized: false,
    });
  },
}));
