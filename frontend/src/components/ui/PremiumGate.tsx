'use client';

import React, { useEffect } from 'react';
import { Sparkles, Lock, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useSubscriptionStore, SubscriptionPlan } from '@/store/useSubscriptionStore';

type BooleanFeature = keyof Pick<
  SubscriptionPlan,
  | 'canUseMidtrans'
  | 'canUseQRIS'
  | 'canUseExport'
  | 'canUseAnalytics'
  | 'canUseAPI'
  | 'canUseAI'
  | 'canUseMultiBranch'
  | 'canUseLoyalty'
  | 'canUsePromo'
>;

interface PremiumGateProps {
  feature: BooleanFeature;
  children: React.ReactNode;
  /** If true, renders children dimmed with a lock overlay instead of replacing them */
  overlay?: boolean;
  featureLabel?: string;
}

const featureLabels: Record<BooleanFeature, string> = {
  canUseMidtrans: 'Payment Gateway Midtrans',
  canUseQRIS: 'Pembayaran QRIS',
  canUseExport: 'Export Laporan',
  canUseAnalytics: 'Analitik Lanjutan',
  canUseAPI: 'API Access',
  canUseAI: 'AI Analytics',
  canUseMultiBranch: 'Multi Cabang',
  canUseLoyalty: 'Loyalty Member',
  canUsePromo: 'Promo & Voucher',
};

export default function PremiumGate({
  feature,
  children,
  overlay = false,
  featureLabel,
}: PremiumGateProps) {
  const { canUse, isInitialized, fetchSubscription } = useSubscriptionStore();

  useEffect(() => {
    if (!isInitialized) {
      fetchSubscription();
    }
  }, [isInitialized, fetchSubscription]);

  const hasAccess = canUse(feature);
  const label = featureLabel || featureLabels[feature] || feature;

  if (hasAccess) {
    return <>{children}</>;
  }

  if (overlay) {
    return (
      <div className="relative">
        {/* Dimmed children */}
        <div className="pointer-events-none select-none opacity-40 blur-[1px]">{children}</div>

        {/* Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl border border-amber-500/30 z-10 p-6 text-center">
          <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center mb-3">
            <Lock className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-xs font-bold text-white mb-1">Fitur Premium</p>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
            {label} hanya tersedia untuk paket <span className="text-amber-400 font-bold">Premium</span>.
          </p>
          <Link
            href="/dashboard/subscription"
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-lg shadow-amber-500/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Upgrade Sekarang
          </Link>
        </div>
      </div>
    );
  }

  // Block mode: render upgrade prompt instead of children
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5">
      <div className="w-14 h-14 bg-gradient-to-br from-amber-400/20 to-orange-400/20 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
        <Sparkles className="h-7 w-7 text-amber-400" />
      </div>

      <h3 className="text-base font-extrabold text-white mb-2">
        Fitur {label}
      </h3>
      <p className="text-xs text-slate-400 leading-relaxed max-w-xs mb-6">
        Fitur ini hanya tersedia untuk pengguna paket{' '}
        <span className="text-amber-400 font-bold">Premium</span>. Upgrade sekarang untuk
        mengakses semua fitur tanpa batas.
      </p>

      <Link
        href="/dashboard/subscription"
        className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5"
      >
        <Sparkles className="h-4 w-4" />
        Upgrade ke Premium
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

// ── Convenience inline wrapper for small UI elements ──

interface PremiumBadgeProps {
  feature: BooleanFeature;
  children: React.ReactNode;
}

export function PremiumBadge({ feature, children }: PremiumBadgeProps) {
  const { canUse } = useSubscriptionStore();
  const hasAccess = canUse(feature);

  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative inline-flex">
      <div className="opacity-50 pointer-events-none">{children}</div>
      <Link
        href="/dashboard/subscription"
        className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white rounded-full p-0.5 hover:bg-amber-400 transition-colors"
        title="Fitur Premium"
      >
        <Lock className="h-2.5 w-2.5" />
      </Link>
    </div>
  );
}
