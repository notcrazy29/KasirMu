import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import {
  checkFeatureAccess,
  checkResourceLimit,
  PlanFeatures,
} from '../services/subscription';

// ──────────────────────────────────────────────────
// Feature labels for error messages
// ──────────────────────────────────────────────────

const featureLabels: Record<keyof PlanFeatures, string> = {
  maxStore: 'Toko',
  maxProduct: 'Produk',
  maxCashier: 'Kasir',
  maxCategory: 'Kategori',
  canUseMidtrans: 'Payment Gateway Midtrans',
  canUseQRIS: 'Pembayaran QRIS',
  canUseExport: 'Export Laporan (Excel/PDF)',
  canUseAnalytics: 'Analitik Lanjutan',
  canUseAPI: 'API Access',
  canUseAI: 'AI Analytics & Prediksi',
  canUseMultiBranch: 'Multi Cabang',
  canUseLoyalty: 'Loyalty Member',
  canUsePromo: 'Promo & Voucher',
};

// ──────────────────────────────────────────────────
// Middleware: check boolean feature flag
// Usage: checkFeature('canUseQRIS')
// ──────────────────────────────────────────────────

export const checkFeature = (feature: keyof PlanFeatures) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // SUPER_ADMIN bypasses all subscription checks
    if (req.user?.role === 'SUPER_ADMIN') return next();

    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { allowed, planName } = await checkFeatureAccess(ownerId, feature);

      if (!allowed) {
        const label = featureLabels[feature] || feature;
        return res.status(403).json({
          message: `Fitur ${label} hanya tersedia untuk paket Premium. Upgrade sekarang untuk mengakses fitur ini.`,
          code: 'FEATURE_NOT_AVAILABLE',
          feature,
          planName,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// ──────────────────────────────────────────────────
// Middleware: check resource limit before create
// Usage: checkLimit('product', (req) => req.body.storeId)
// ──────────────────────────────────────────────────

type ResourceType = 'store' | 'product' | 'cashier' | 'category';

const resourceMessages: Record<ResourceType, { label: string; verb: string }> = {
  store: { label: 'toko', verb: 'menambahkan toko' },
  product: { label: 'produk', verb: 'menambahkan produk' },
  cashier: { label: 'kasir', verb: 'menambahkan kasir' },
  category: { label: 'kategori', verb: 'menambahkan kategori' },
};

export const checkLimit = (
  resource: ResourceType,
  getStoreId?: (req: AuthRequest) => string | undefined
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // SUPER_ADMIN bypasses all subscription checks
    if (req.user?.role === 'SUPER_ADMIN') return next();

    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const storeId = getStoreId ? getStoreId(req) : undefined;
      const result = await checkResourceLimit(ownerId, resource, storeId);

      if (!result.allowed) {
        const { label, verb } = resourceMessages[resource];
        const maxLabel = result.max === -1 ? 'Unlimited' : `${result.max}`;
        return res.status(403).json({
          message:
            result.max === -1
              ? `Tidak dapat ${verb} saat ini.`
              : `Batas maksimal paket FREE adalah ${result.max} ${label}. Upgrade ke Premium untuk ${verb} lebih banyak.`,
          code: 'SUBSCRIPTION_LIMIT_EXCEEDED',
          resource,
          current: result.current,
          max: result.max,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
