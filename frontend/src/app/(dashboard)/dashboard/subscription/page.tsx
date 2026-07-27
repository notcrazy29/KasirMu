'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import {
  CreditCard,
  Check,
  Sparkles,
  Calendar,
  CheckCircle,
  AlertCircle,
  X,
  Store,
  Package,
  Users,
  Tag,
  Zap,
  FileText,
  BarChart3,
  Brain,
  Globe,
  GitBranch,
  Heart,
  Gift,
  Lock,
  Infinity,
  Clock,
  AlertTriangle,
  RefreshCw,
  Timer,
  Crown,
  ShieldCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  features: string;
  durationDays: number;
  isActive: boolean;
  maxStore: number;
  maxProduct: number;
  maxCashier: number;
  maxCategory: number;
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

const formatCurrency = (amount: number | string) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(amount));

const formatDate = (date: string | null | undefined) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const isUnlimitedDate = (date: string | null | undefined) => {
  if (!date) return false;
  return new Date(date).getFullYear() > 2100;
};

// ── Countdown hook ──
const useCountdown = (endDate: string | null | undefined) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [progressPercent, setProgressPercent] = useState(100);

  useEffect(() => {
    if (!endDate || isUnlimitedDate(endDate)) {
      setTimeLeft(null);
      setProgressPercent(100);
      return;
    }

    const end = new Date(endDate).getTime();

    const calcTimeLeft = () => {
      const now = Date.now();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setProgressPercent(0);
        return;
      }
      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setTimeLeft({ days, hours, minutes, seconds });

      // Calculate progress (assuming 30 day subscription)
      const totalDuration = 30 * 24 * 3600 * 1000;
      const elapsed = totalDuration - diff;
      const pct = Math.max(0, Math.min(100, 100 - (elapsed / totalDuration) * 100));
      setProgressPercent(pct);
    };

    calcTimeLeft();
    const interval = setInterval(calcTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  return { timeLeft, progressPercent };
};

// ── Feature Flag Icons ──
const featureIcons = [
  { key: 'canUseMidtrans', label: 'Payment Gateway', icon: CreditCard, color: 'text-blue-400' },
  { key: 'canUseQRIS', label: 'QRIS Midtrans', icon: Zap, color: 'text-emerald-400' },
  { key: 'canUseExport', label: 'Export Excel/PDF', icon: FileText, color: 'text-violet-400' },
  { key: 'canUseAnalytics', label: 'Analitik Lanjutan', icon: BarChart3, color: 'text-amber-400' },
  { key: 'canUseAI', label: 'AI Analytics', icon: Brain, color: 'text-pink-400' },
  { key: 'canUseMultiBranch', label: 'Multi Cabang', icon: GitBranch, color: 'text-cyan-400' },
  { key: 'canUseLoyalty', label: 'Loyalty Member', icon: Heart, color: 'text-rose-400' },
  { key: 'canUsePromo', label: 'Promo & Voucher', icon: Gift, color: 'text-orange-400' },
  { key: 'canUseAPI', label: 'API Access', icon: Globe, color: 'text-teal-400' },
];

// ── Premium features list ──
const PREMIUM_FEATURES = [
  'Maksimal 5 Store',
  'Produk Unlimited',
  'Kasir Unlimited',
  'Dashboard Analytics',
  'Export PDF',
  'Export Excel',
  'Audit Log',
  'Multi Store',
  'Payment Gateway Midtrans',
  'Semua fitur Premium',
];

// ── Usage bar ──
function UsageBar({ label, current, max, icon: Icon }: { label: string; current: number; max: number; icon: React.ElementType }) {
  const isUnlimited = max === -1;
  const percent = isUnlimited ? Math.min(10 + current * 2, 30) : Math.min(100, Math.round((current / Math.max(max, 1)) * 100));
  const isWarning = !isUnlimited && percent >= 80;
  const isFull = !isUnlimited && percent >= 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
          <Icon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <span>{label}</span>
        </div>
        <span className={`font-bold tabular-nums ${isFull ? 'text-rose-600 dark:text-rose-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-400'}`}>
          {current}
          <span className="text-slate-400 dark:text-slate-600 mx-0.5">/</span>
          {isUnlimited ? <Infinity className="h-3 w-3 inline text-emerald-600 dark:text-emerald-400" /> : max}
        </span>
      </div>
      <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            isFull ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : isUnlimited ? 'bg-emerald-500' : 'bg-blue-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ── Confirm Checkout Popup ──
function CheckoutConfirmModal({
  plan,
  onConfirm,
  onCancel,
  isProcessing,
}: {
  plan: Plan;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header gradient */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />

        <div className="p-6">
          {/* Icon + Title */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Crown className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">Upgrade ke Premium</h3>
              <p className="text-xs text-slate-400">Konfirmasi pembayaran langganan</p>
            </div>
          </div>

          {/* Detail */}
          <div className="flex flex-col gap-3 mb-5 p-4 bg-slate-800/50 rounded-xl border border-slate-700/40">
            <p className="text-sm text-slate-300">
              Anda akan berlangganan <strong className="text-white">Paket Premium KasirMu POS</strong>.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">Harga</span>
                <span className="text-xl font-black text-amber-400">{formatCurrency(plan.price)}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">Durasi</span>
                <span className="text-xl font-black text-white">{plan.durationDays} Hari</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-700/40">
              {PREMIUM_FEATURES.slice(0, 5).map((feat) => (
                <div key={feat} className="flex items-center gap-2 text-xs text-slate-400">
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 mb-5 p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl">
            <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              Subscription akan aktif setelah pembayaran berhasil diverifikasi oleh Midtrans. Pembayaran menggunakan platform Midtrans yang aman.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 py-2.5 px-4 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-sm font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 cursor-pointer"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Memproses...
                </span>
              ) : 'Lanjutkan Pembayaran'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OwnerSubscriptionPage() {
  const { subscription, plan, isPremium, isGracePeriod, gracePeriodUntil, usage, fetchSubscription, trialClaim } = useSubscriptionStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'subscription' | 'history'>('subscription');
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Confirm modal state
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);

  // Countdown for premium
  const { timeLeft, progressPercent } = useCountdown(isPremium ? subscription?.endDate : null);

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchSubscription(),
      api.get('/subscriptions/plans').then((res) => setPlans(res.plans || [])).catch(console.error),
    ]);
    setIsLoading(false);
  };

  const loadPaymentHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.get('/subscriptions/payment-history');
      setPaymentHistory(res.payments || []);
    } catch (err) {
      console.error('Failed to load payment history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadPaymentHistory();
    }
  }, [activeTab]);

  // Days left calculation
  const getDaysLeft = useCallback(() => {
    if (!subscription?.endDate) return 0;
    const diff = new Date(subscription.endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [subscription?.endDate]);

  const isExpired = subscription?.status === 'EXPIRED';
  const daysLeft = getDaysLeft();
  const isExpiringSoon = isPremium && daysLeft <= 7 && daysLeft > 0;

  // Grace period countdown (days until grace period ends)
  const getGraceDaysLeft = useCallback(() => {
    if (!gracePeriodUntil) return 0;
    const diff = new Date(gracePeriodUntil).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [gracePeriodUntil]);
  const graceDaysLeft = getGraceDaysLeft();

  const handleUpgradeClick = (targetPlan: Plan) => {
    if (isSubmitting) return;
    if (targetPlan.name === 'FREE') return;
    setConfirmPlan(targetPlan);
  };

  const handleConfirmCheckout = async () => {
    if (!confirmPlan) return;
    setIsSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const checkoutRes = await api.post('/subscriptions/checkout', { planId: confirmPlan.id });

      if (checkoutRes.simulatorMode) {
        // Simulator mode: auto-confirm upgrade
        setConfirmPlan(null);
        await api.post('/subscriptions/simulate', { planId: confirmPlan.id });
        setSuccessMsg('🎉 Selamat! Upgrade ke Paket Premium berhasil!');
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
        await fetchSubscription();
      } else {
        setConfirmPlan(null);
        // Open Midtrans Snap
        const { snapToken, clientKey, environment: snapEnv } = checkoutRes;

        // Dynamically load Midtrans Snap JS if not already loaded
        if (!(window as any).snap) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = snapEnv === 'PRODUCTION'
              ? 'https://app.midtrans.com/snap/snap.js'
              : 'https://app.sandbox.midtrans.com/snap/snap.js';
            script.setAttribute('data-client-key', clientKey);
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Gagal memuat Midtrans Snap SDK'));
            document.head.appendChild(script);
          });
        }

        (window as any).snap.pay(snapToken, {
          onSuccess: async (result: any) => {
            try {
              await api.post('/subscriptions/verify-payment', {
                orderId: checkoutRes.orderId || result?.order_id,
              });
            } catch (vErr) {
              console.warn('[Subscription] Verify payment API error:', vErr);
            }
            setSuccessMsg('🎉 Pembayaran berhasil! Paket Premium Anda kini aktif.');
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
            await fetchSubscription();
          },
          onPending: () => {
            setSuccessMsg('Pembayaran sedang diproses. Mohon tunggu konfirmasi dari Midtrans.');
          },
          onError: () => {
            setErrorMsg('Pembayaran gagal. Silakan coba kembali.');
          },
          onClose: () => {
            console.log('[Snap] Closed by user');
          },
        });
      }
    } catch (err: any) {
      setConfirmPlan(null);
      setErrorMsg(err.message || 'Gagal memproses pembayaran. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
          <span className="text-xs text-slate-500">Memuat data subscription...</span>
        </div>
      </div>
    );
  }

  const premiumPlan = plans.find((p) => p.name === 'PREMIUM');

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">

      {/* ── Confirm Modal ── */}
      {confirmPlan && (
        <CheckoutConfirmModal
          plan={confirmPlan}
          onConfirm={handleConfirmCheckout}
          onCancel={() => setConfirmPlan(null)}
          isProcessing={isSubmitting}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-500" />
            Paket Langganan
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Kelola paket subscription KasirMu dan pantau penggunaan fitur Anda
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shrink-0">
          <button
            onClick={() => setActiveTab('subscription')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'subscription'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Langganan
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Riwayat Bayar
          </button>
        </div>
      </div>

      {/* ── Subscription Tab Content ── */}
      {activeTab === 'subscription' && (
        <div className="flex flex-col gap-8">

      {/* ── Notifications ── */}
      {successMsg && (
        <div className="p-4 bg-emerald-950 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-semibold flex items-center gap-3 animate-in slide-in-from-top">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="ml-auto hover:text-emerald-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-950 border border-red-500/30 text-red-400 rounded-xl text-sm font-semibold flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="ml-auto hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Grace Period Banner ── */}
      {isGracePeriod && (
        <div className="p-5 bg-amber-950/40 border border-amber-500/40 rounded-2xl">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-300 mb-1">Langganan Premium Anda telah berakhir</h3>
              <p className="text-xs text-slate-400 mb-1">
                Anda masih berada dalam <strong className="text-amber-400">Masa Tenggang selama 7 hari</strong>.
              </p>
              {gracePeriodUntil && (
                <p className="text-xs text-slate-400 mb-3">
                  Masa tenggang berakhir pada{' '}
                  <span className="text-amber-300 font-semibold">
                    {new Date(gracePeriodUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  {graceDaysLeft > 0 && (
                    <span className="ml-1 text-amber-400 font-bold">({graceDaysLeft} hari lagi)</span>
                  )}.
                </p>
              )}
              <p className="text-xs text-slate-400 mb-3">
                Selama masa tenggang, Anda masih dapat melihat data toko, produk, transaksi, dan laporan.
                Namun fitur Premium telah dinonaktifkan sementara. Silakan lakukan pembayaran untuk mengaktifkan kembali seluruh fitur Premium.
              </p>
              {premiumPlan && (
                <button
                  onClick={() => handleUpgradeClick(premiumPlan)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className="h-4 w-4" />
                  Perpanjang Langganan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Expiring Soon Banner ── */}
      {isExpiringSoon && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/30 text-amber-300 rounded-xl text-sm font-semibold flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>⚠️ Subscription Premium Anda akan berakhir dalam <strong>{daysLeft} hari</strong>. Segera perpanjang!</span>
          {premiumPlan && (
            <button
              onClick={() => handleUpgradeClick(premiumPlan)}
              className="ml-auto shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg transition-all cursor-pointer"
            >
              Perpanjang
            </button>
          )}
        </div>
      )}

      {/* ── Expired Banner ── */}
      {isExpired && (
        <div className="p-5 bg-red-950/40 border border-red-500/30 rounded-2xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-300 mb-1">Langganan Premium Telah Berakhir</h3>
              <p className="text-xs text-slate-400 mb-3">
                Fitur Premium Anda telah dinonaktifkan. Data toko, produk, dan transaksi Anda tetap aman dan tersimpan. Perpanjang untuk mengakses kembali semua fitur Premium.
              </p>
              {premiumPlan && (
                <button
                  onClick={() => handleUpgradeClick(premiumPlan)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                  Perpanjang Langganan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Current Plan Card ── */}
      {isPremium ? (
        <div className="border border-amber-500/40 bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-950 p-6 md:p-8 rounded-2xl relative overflow-hidden shadow-2xl">
          {/* Light beam */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="border-b border-slate-800/80 pb-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xs font-black tracking-widest text-amber-400 uppercase">LANGGANAN SAYA</h2>
              <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Premium Aktif
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-6 mb-8 text-sm">
            <div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider block mb-1">Paket Saat Ini</span>
              <span className="flex items-center gap-1.5 text-base font-black text-white">
                <Crown className="h-4 w-4 text-amber-400" />
                {plan?.name || 'PREMIUM'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider block mb-1">Harga</span>
              <span className="text-base font-black text-white">
                {plan?.name === 'PREMIUM TRIAL' ? 'Rp0 (Uji Coba)' : formatCurrency(plan?.price ?? 80000)}
                {plan?.name !== 'PREMIUM TRIAL' && <span className="text-xs font-normal text-slate-300"> / Bulan</span>}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider block mb-1">Status</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-block">
                {plan?.name === 'PREMIUM TRIAL' ? 'Trial Aktif' : 'Aktif'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider block mb-1">Berlaku Sampai</span>
              <span className="text-base font-black text-white">
                {formatDate(subscription?.endDate)}
              </span>
            </div>
          </div>

          {/* ── Countdown Timer ── */}
          {timeLeft && !isUnlimitedDate(subscription?.endDate) && (
            <div className="mb-6 p-5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-amber-400" />
                  Sisa Waktu
                </span>
                <span className="text-xs font-bold text-slate-300">
                  Berlaku sampai {formatDate(subscription?.endDate)}
                </span>
              </div>

              {/* Countdown digits */}
              <div className="flex items-center gap-3 mb-4">
                {[
                  { value: timeLeft.days, label: 'Hari' },
                  { value: timeLeft.hours, label: 'Jam' },
                  { value: timeLeft.minutes, label: 'Menit' },
                  { value: timeLeft.seconds, label: 'Detik' },
                ].map(({ value, label }) => (
                  <div key={label} className="flex-1 text-center">
                    <div className={`text-2xl font-black tabular-nums leading-none mb-1 ${
                      daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-amber-400' : 'text-white'
                    }`}>
                      {String(value).padStart(2, '0')}
                    </div>
                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{label}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-300 font-medium">
                  <span>Progress masa aktif</span>
                  <span className="font-bold text-white">{Math.round(progressPercent)}%</span>
                </div>
                <div className="h-2 bg-slate-700/80 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      progressPercent > 50 ? 'bg-emerald-500' :
                      progressPercent > 20 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Active features */}
          <div className="border-t border-b border-slate-800/80 py-6 mb-6">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block mb-4">Fitur Aktif</span>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {PREMIUM_FEATURES.map((feat) => (
                <div key={feat} className="flex items-center gap-2.5 text-xs text-slate-100 font-semibold">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Renew button */}
          <div className="flex flex-wrap gap-4">
            {premiumPlan && (
              <button
                onClick={() => handleUpgradeClick(premiumPlan)}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 hover:-translate-y-0.5 cursor-pointer"
              >
                {isSubmitting ? 'Memproses...' : 'Perpanjang Langganan'}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ── FREE Plan Card ── */
        <div className={`rounded-2xl border p-6 relative overflow-hidden border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 shadow-sm`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-slate-900 dark:text-white">{plan?.name || 'FREE'}</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                      Gratis
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{plan?.description}</p>
                </div>
              </div>
            </div>

            {/* Upgrade CTA */}
            <div className="shrink-0">
              {premiumPlan && (
                <button
                  onClick={() => handleUpgradeClick(premiumPlan)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-0.5 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  {isSubmitting ? 'Memproses...' : 'Upgrade ke Premium'}
                </button>
              )}
            </div>
          </div>

          {/* Usage Stats */}
          <div className="mt-6 pt-6 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UsageBar label="Toko" current={usage.stores} max={plan?.maxStore ?? 1} icon={Store} />
            <UsageBar label="Produk" current={usage.products} max={plan?.maxProduct ?? 5} icon={Package} />
            <UsageBar label="Kasir" current={usage.cashiers} max={plan?.maxCashier ?? 1} icon={Users} />
            <UsageBar label="Kategori" current={usage.categories} max={plan?.maxCategory ?? 2} icon={Tag} />
          </div>
        </div>
      )}

      {/* ── Feature Flags Grid ── */}
      <Card>
        <CardHeader className="border-slate-100 dark:border-slate-800/60 pb-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Fitur Tersedia</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Fitur yang bisa Anda gunakan pada paket aktif saat ini</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {featureIcons.map(({ key, label, icon: Icon, color }) => {
              const hasFeature = plan ? (plan as any)[key] as boolean : false;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                    hasFeature
                      ? 'border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 shadow-xs'
                      : 'border-slate-200/60 dark:border-slate-800/30 bg-slate-100/50 dark:bg-slate-900/10 opacity-60'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${hasFeature ? 'bg-slate-200/80 dark:bg-slate-700/60' : 'bg-slate-200/40 dark:bg-slate-800/40'}`}>
                    {hasFeature ? <Icon className={`h-3.5 w-3.5 ${color}`} /> : <Lock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600" />}
                  </div>
                  <div>
                    <span className={`text-[11px] font-bold ${hasFeature ? 'text-slate-900 dark:text-slate-200' : 'text-slate-500 dark:text-slate-600'}`}>
                      {label}
                    </span>
                    {!hasFeature && (
                      <span className="block text-[9px] text-slate-400 dark:text-slate-600 uppercase font-bold tracking-wider">Premium</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Premium Plan Card (only shown when FREE) ── */}
      {!isPremium && !isExpired && premiumPlan && (
        <div className="relative rounded-2xl border border-amber-500/50 bg-gradient-to-br from-amber-950/60 to-orange-950/40 p-6 shadow-xl shadow-amber-500/10 overflow-hidden">
          {/* Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />

          {/* Badge */}
          <div className="absolute top-4 right-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" />
            Recommended
          </div>

          <div className="flex flex-col gap-5">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-5 w-5 text-amber-400" />
                <h3 className="text-lg font-black text-white">PAKET PREMIUM</h3>
              </div>
              <p className="text-xs text-slate-400">{premiumPlan.description || 'Akses semua fitur KasirMu tanpa batas'}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{formatCurrency(premiumPlan.price)}</span>
                <span className="text-sm text-slate-400">/ {premiumPlan.durationDays} Hari</span>
              </div>
            </div>

            {/* Features */}
            <div className="grid sm:grid-cols-2 gap-2">
              {PREMIUM_FEATURES.map((feat) => (
                <div key={feat} className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
                  <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => handleUpgradeClick(premiumPlan)}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 rounded-xl transition-all shadow-lg shadow-amber-500/20 hover:-translate-y-0.5 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              {isSubmitting ? 'Memproses...' : 'Berlangganan Sekarang'}
            </button>

            <p className="text-center text-[10px] text-slate-400">
              Pembayaran diproses secara aman melalui Midtrans. Subscription aktif setelah verifikasi pembayaran.
            </p>
          </div>
        </div>
      )}

      {/* ── Premium Active Info ── */}
      {isPremium && (
        <Card className="border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 p-5 flex items-start gap-4">
          <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Anda sudah menggunakan paket Premium!</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
              Seluruh fitur KasirMu sudah terbuka untuk Anda. Nikmati QRIS, analytics, export laporan, dan semua fitur tanpa batas hingga{' '}
              <span className="text-slate-900 dark:text-white font-bold">{formatDate(subscription?.endDate)}</span>.
            </p>
          </div>
        </Card>
      )}

        </div>
      )}

      {/* ── Payment History Tab ── */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Riwayat Pembayaran</h2>
            <button
              onClick={loadPaymentHistory}
              disabled={isLoadingHistory}
              className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {isLoadingHistory ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-blue-500" />
            </div>
          ) : paymentHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
              <CreditCard className="h-10 w-10 text-slate-400 dark:text-slate-700" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Belum ada riwayat pembayaran</p>
              <p className="text-xs text-center max-w-xs text-slate-500 dark:text-slate-400">
                Riwayat pembayaran Anda akan muncul di sini setelah transaksi berhasil.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                    <th className="text-left px-4 py-3 text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">Order ID</th>
                    <th className="text-left px-4 py-3 text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">Paket</th>
                    <th className="text-left px-4 py-3 text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">Jumlah</th>
                    <th className="text-left px-4 py-3 text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">Metode</th>
                    <th className="text-left px-4 py-3 text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">Tanggal Bayar</th>
                    <th className="text-left px-4 py-3 text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">Berlaku Hingga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {paymentHistory.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300 text-[11px]">{p.orderId ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                          <Crown className="h-3 w-3 text-amber-500" />
                          {p.planName}
                        </span>
                        <span className="text-slate-500">{p.durationDays} hari</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {p.paymentMethod ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          p.status === 'PAID'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : p.status === 'PENDING'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20'
                        }`}>
                          {p.status === 'PAID' ? 'Berhasil' : p.status === 'PENDING' ? 'Menunggu' : 'Gagal'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {p.paidAt
                          ? new Date(p.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {p.subscriptionEndDate
                          ? new Date(p.subscriptionEndDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
