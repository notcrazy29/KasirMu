import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { getOwnerActivePlan, OwnerSubscriptionInfo } from '../services/subscription';

// Extend AuthRequest to include subscription info
declare module './auth' {
  interface AuthRequest {
    subscription?: OwnerSubscriptionInfo | null;
  }
}

// ──────────────────────────────────────────────────
// checkSubscription middleware
// Reads the active subscription for the current owner
// and attaches it to req.subscription
// Performs auto-expire check on each request
// ──────────────────────────────────────────────────
export const checkSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    const role = req.user?.role;

    // Only apply to OWNERs
    if (!ownerId || role !== 'OWNER') {
      return next();
    }

    // Get active plan (auto-expires stale subscriptions)
    const subscriptionInfo = await getOwnerActivePlan(ownerId);
    req.subscription = subscriptionInfo;

    next();
  } catch (error) {
    // Non-blocking: if subscription check fails, let the request through
    console.error('[checkSubscription] Failed to read subscription:', error);
    next();
  }
};

// ──────────────────────────────────────────────────
// checkPremiumFeature — blocks non-premium owners
// Usage: router.get('/route', authenticate, checkPremiumFeature('canUseAnalytics'))
// ──────────────────────────────────────────────────
export const checkPremiumFeature = (feature: string) => async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    const role = req.user?.role;

    // Super Admin bypass
    if (role === 'SUPER_ADMIN') return next();

    if (!ownerId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const info = req.subscription ?? await getOwnerActivePlan(ownerId);

    if (!info) {
      res.status(403).json({
        message: 'Akses ditolak. Anda memerlukan paket Premium untuk menggunakan fitur ini.',
        feature,
        plan: 'NONE',
        isPremium: false,
      });
      return;
    }

    const allowed = info.plan[feature as keyof typeof info.plan] as boolean;

    if (!allowed) {
      res.status(403).json({
        message: `Fitur "${feature}" memerlukan paket Premium. Upgrade sekarang untuk mengakses fitur ini.`,
        feature,
        plan: info.plan.name,
        isPremium: info.isPremium,
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// checkResourceLimit — blocks creation if at limit
// Usage: router.post('/stores', authenticate, checkResourceLimit('store'))
// ──────────────────────────────────────────────────
export const requireResourceCapacity = (resource: 'store' | 'product' | 'cashier' | 'category') => async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    const role = req.user?.role;

    // Super Admin bypass
    if (role === 'SUPER_ADMIN') return next();

    if (!ownerId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const info = req.subscription ?? await getOwnerActivePlan(ownerId);

    if (!info) {
      res.status(403).json({ message: 'Subscription tidak ditemukan.' });
      return;
    }

    const resourceMap: Record<string, { current: number; max: number }> = {
      store: { current: info.usage.stores, max: info.plan.maxStore },
      product: { current: info.usage.products, max: info.plan.maxProduct },
      cashier: { current: info.usage.cashiers, max: info.plan.maxCashier },
      category: { current: info.usage.categories, max: info.plan.maxCategory },
    };

    const { current, max } = resourceMap[resource];

    // -1 = unlimited
    if (max !== -1 && current >= max) {
      const labelMap: Record<string, string> = {
        store: 'toko',
        product: 'produk',
        cashier: 'kasir',
        category: 'kategori',
      };
      res.status(403).json({
        message: `Anda telah mencapai batas maksimal ${max} ${labelMap[resource]} untuk paket ${info.plan.name}. Upgrade ke Premium untuk menambah lebih banyak.`,
        resource,
        current,
        max,
        plan: info.plan.name,
        isPremium: info.isPremium,
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
