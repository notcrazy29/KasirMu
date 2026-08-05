'use client';

import React, { useEffect, useState, useCallback } from 'react';

import { useAuthStore } from '@/store/useAuthStore';
import { useSocket } from '@/hooks/useSocket';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import api from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle, 
  Activity, 
  Smartphone,
  ChevronRight,
  Sparkles,
  Lock,
  Store,
  Package,
  Users,
  Crown,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Timer,
  TrendingUp,
  Coins,
  Receipt,
} from 'lucide-react';
import Link from 'next/link';


interface DashboardSummary {
  totalRevenue: number;
  totalTxCount: number;
  totalProductsSold: number;
  totalTax: number;
  totalProfit: number;
  paymentSplit: { CASH: number; QRIS: number };
}

interface RecentTransaction {
  id: string;
  transactionNumber: string;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  cashierName?: string;
  cashier?: {
    name: string;
  };
}

interface StockAlert {
  id: string;
  name: string;
  stock: number;
  minStockAlert: number;
}

// ── Countdown hook (per second) ──
function useCountdown(endDate: string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number } | null>(null);

  useEffect(() => {
    if (!endDate) { setTimeLeft(null); return; }
    const end = new Date(endDate).getTime();
    // If FREE plan has year > 2100, treat as no countdown needed
    if (new Date(endDate).getFullYear() > 2100) { setTimeLeft(null); return; }

    const calc = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0 }); return; }
      const totalSeconds = Math.floor(diff / 1000);
      setTimeLeft({
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
      });
    };

    calc();
    const id = setInterval(calc, 60000); // update every minute
    return () => clearInterval(id);
  }, [endDate]);

  return timeLeft;
}

// ── Toast notification ──
function SubscriptionToast({ message, type, onClose }: { message: string; type: 'success' | 'warning' | 'error'; onClose: () => void }) {
  const colors = {
    success: 'bg-emerald-950 border-emerald-500/30 text-emerald-300',
    warning: 'bg-amber-950/60 border-amber-500/30 text-amber-300',
    error: 'bg-red-950 border-red-500/30 text-red-300',
  };
  const icons = {
    success: <CheckCircle2 className="h-5 w-5 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 shrink-0" />,
    error: <XCircle className="h-5 w-5 shrink-0" />,
  };

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm flex items-start gap-3 p-4 rounded-xl border shadow-2xl animate-in slide-in-from-top-2 ${colors[type]}`}>
      {icons[type]}
      <p className="text-sm font-semibold flex-1">{message}</p>
      <button onClick={onClose} className="shrink-0 hover:opacity-70 transition-opacity">
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function DashboardOverview() {

  const { currentStoreId } = useAuthStore();
  const socket = useSocket();
  const { plan, isPremium, isGracePeriod, gracePeriodUntil, usage, isInitialized, subscription, fetchSubscription, updateFromGracePeriodSocket } = useSubscriptionStore();

  const [summary, setSummary] = useState<DashboardSummary>({
    totalRevenue: 0,
    totalTxCount: 0,
    totalProductsSold: 0,
    totalTax: 0,
    totalProfit: 0,
    paymentSplit: { CASH: 0, QRIS: 0 },
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Toast state for subscription events
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Countdown for premium expiry
  const timeLeft = useCountdown(isPremium ? subscription?.endDate : null);

  // Fetch initial analytics metrics for TODAY (Asia/Jakarta timezone)
  const fetchDashboardData = useCallback(async () => {
    if (!currentStoreId) return;
    try {
      const stats = await api.get(`/analytics/dashboard?storeId=${currentStoreId}&period=today`);
      setSummary(stats.summary);
      setStockAlerts(stats.stockAlerts);
      
      const txResponse = await api.get(`/transactions?storeId=${currentStoreId}&period=today`);
      setRecentTransactions(txResponse.transactions.slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentStoreId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Client-side 00:00 Asia/Jakarta Date-Change Monitor
  useEffect(() => {
    let lastDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const interval = setInterval(() => {
      const currentDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      if (currentDateStr !== lastDateStr) {
        lastDateStr = currentDateStr;
        fetchDashboardData();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  // Real-time Event Subscriptions via Socket.IO
  useEffect(() => {
    if (!socket.isConnected) return;

    // Midnight reset listener
    socket.on('midnight_reset', () => {
      console.log('[Socket] Midnight reset triggered! Refreshing today dashboard...');
      fetchDashboardData();
    });

    // Listen to new transactions completed
    socket.on('new_transaction', (newTx: RecentTransaction) => {
      console.log('[Socket] New transaction received:', newTx);
      fetchDashboardData();
    });

    // Listen to payment status callbacks
    socket.on('payment_status', (update: { transactionId: string; transactionNumber: string; status: string }) => {
      console.log('[Socket] Payment status update:', update);
      fetchDashboardData();
    });

    // Listen to stock adjustment syncs
    socket.on('stock_update', (update: { productId: string; newStock: number }) => {
      console.log('[Socket] Stock update received:', update);
      fetchDashboardData();
    });

    // ── Subscription realtime events ──
    socket.on('subscription_upgraded', (data: { planName: string; endDate: string; message: string }) => {
      setToast({ message: data.message || `🎉 Paket ${data.planName} Anda sudah aktif!`, type: 'success' });
      fetchSubscription();
    });

    socket.on('subscription_grace_period', (data: { planName: string; gracePeriodUntil: string; message: string }) => {
      setToast({ message: data.message || '⚠️ Langganan Premium Anda telah berakhir. Masa Tenggang aktif.', type: 'warning' });
      updateFromGracePeriodSocket({ isGracePeriod: true, gracePeriodUntil: data.gracePeriodUntil, message: data.message });
    });

    socket.on('subscription_expired', (data: { planName: string; message: string }) => {
      setToast({ message: data.message || '❌ Masa Tenggang telah berakhir. Akun Anda sekarang menggunakan paket FREE.', type: 'error' });
      fetchSubscription();
    });

    socket.on('subscription_warning', (data: { message: string; daysLeft: number }) => {
      setToast({ message: data.message, type: 'warning' });
    });

    return () => {
      socket.off('midnight_reset');
      socket.off('new_transaction');
      socket.off('payment_status');
      socket.off('stock_update');
      socket.off('subscription_upgraded');
      socket.off('subscription_grace_period');
      socket.off('subscription_expired');
      socket.off('subscription_warning');
    };
  }, [socket.isConnected, currentStoreId, fetchSubscription, updateFromGracePeriodSocket, fetchDashboardData]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Toast Notification */}
      {toast && (
        <SubscriptionToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Ringkasan Bisnis</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Pantau performa transaksi Anda secara realtime</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-semibold">
          <Activity className="h-4.5 w-4.5 text-emerald-500 animate-pulse" />
          <span className="text-slate-700 dark:text-slate-300">Live Sync Aktif</span>
        </div>
      </div>

      {/* Subscription Status Banner */}
      {isInitialized && (
        <>
      {/* GRACE PERIOD banner — shown when subscription is in grace period */}
          {isGracePeriod && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 dark:from-amber-950/60 dark:to-orange-950/30 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-300">Langganan Premium Anda telah berakhir</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Anda masih berada dalam <strong className="text-amber-700 dark:text-amber-400">Masa Tenggang 7 hari</strong>.
                    {gracePeriodUntil && (
                      <> Berakhir pada <span className="text-amber-800 dark:text-amber-300 font-semibold">{new Date(gracePeriodUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>.</>  
                    )}
                    {' '}Silakan lakukan pembayaran untuk mengaktifkan kembali seluruh fitur Premium.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/subscription"
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-md shadow-amber-500/20 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Perpanjang Langganan
              </Link>
            </div>
          )}

          {/* EXPIRED banner — shown when last subscription expired (not grace period) */}
          {!isPremium && !isGracePeriod && subscription?.status === 'EXPIRED' && (
            <div className="rounded-xl border border-red-300 dark:border-red-500/30 bg-gradient-to-r from-red-50 to-rose-100 dark:from-red-950/40 dark:to-rose-950/20 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-900 dark:text-red-300">Langganan Premium Anda telah berakhir</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Data toko, produk, dan transaksi Anda tetap aman.</p>
                </div>
              </div>
              <Link
                href="/dashboard/subscription"
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-md shadow-amber-500/20 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Perpanjang Langganan
              </Link>
            </div>
          )}

          {/* Main subscription card */}
          <div className={`rounded-xl border p-4.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all shadow-sm ${
            isPremium
              ? 'border-amber-300 dark:border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-400/10 to-orange-500/10 dark:from-amber-950/70 dark:via-amber-900/40 dark:to-orange-950/50'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40'
          }`}>
            <div className="flex items-center gap-3 flex-1">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                isPremium ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {isPremium ? (
                  <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Lock className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">{plan?.name ?? 'FREE'}</span>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    isPremium
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-bold'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                  }`}>
                    {isPremium ? 'Premium Active' : 'Gratis'}
                  </span>
                  {isPremium && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                      Aktif
                    </span>
                  )}
                </div>

                {/* Premium: show expiry date + countdown */}
                {isPremium && subscription?.endDate && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Aktif hingga{' '}
                      <strong className="text-slate-900 dark:text-amber-300 font-extrabold">
                        {new Date(subscription.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </strong>
                    </span>
                    {timeLeft && (
                      <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <Timer className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Sisa:</span>
                        <span className="font-extrabold text-slate-900 dark:text-slate-200">{timeLeft.days}h {timeLeft.hours}j {timeLeft.minutes}m</span>
                      </span>
                    )}
                  </div>
                )}

                {/* FREE: show usage stats */}
                {!isPremium && (
                  <div className="flex items-center gap-4 mt-1">
                    {[
                      { label: 'Toko', current: usage.stores, max: plan?.maxStore ?? 1, icon: Store },
                      { label: 'Produk', current: usage.products, max: plan?.maxProduct ?? 5, icon: Package },
                      { label: 'Kasir', current: usage.cashiers, max: plan?.maxCashier ?? 1, icon: Users },
                    ].map(({ label, current, max, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <Icon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        <span className="font-bold text-slate-900 dark:text-slate-200">
                          {current}<span className="mx-0.5 text-slate-400 dark:text-slate-600">/</span>
                          {max === -1 ? <span className="text-emerald-600 dark:text-emerald-400">∞</span> : max}
                        </span>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action: FREE → upgrade button | PREMIUM → kelola link */}
            {!isPremium && subscription?.status !== 'EXPIRED' && (
              <Link
                href="/dashboard/subscription"
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/20 whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-4 w-4" />
                Upgrade ke Premium
              </Link>
            )}
            {isPremium && (
              <Link
                href="/dashboard/subscription"
                className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0"
              >
                <span>Kelola Langganan</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </>
      )}

      {/* KPI Cards Grid — Dashboard Hari Ini */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block truncate">Omzet Hari Ini</span>
              <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block truncate">
                {formatCurrency(summary.totalRevenue)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block truncate">Total Transaksi</span>
              <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block truncate">
                {summary.totalTxCount} Transaksi
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 rounded-xl shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block truncate">Produk Terjual</span>
              <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block truncate">
                {summary.totalProductsSold} Item
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/10 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block truncate">Pajak Hari Ini</span>
              <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block truncate">
                {formatCurrency(summary.totalTax)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block truncate">Laba Hari Ini</span>
              <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block truncate">
                {formatCurrency(summary.totalProfit)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/10 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block truncate">Peringatan Stok</span>
              <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block truncate">
                {stockAlerts.length} Item Menipis
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Live Transactions Feed and Stock Warnings */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Transactions (Span 2) */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex items-center justify-between border-slate-100 dark:border-slate-800/60">
              <div>
                <CardTitle>Transaksi Terkini</CardTitle>
                <CardDescription>Daftar checkout kasir terbaru yang terupdate live</CardDescription>
              </div>
              <Link 
                href="/dashboard/transactions" 
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold flex items-center gap-0.5 hover:underline"
              >
                Lihat Semua <ChevronRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentTransactions.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {recentTransactions.map((tx) => (
                    <div 
                      key={tx.id} 
                      className="p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors animate-zoom-in"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">{tx.transactionNumber}</span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            {new Date(tx.createdAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-slate-650 dark:text-slate-350">
                            Kasir: {tx.cashier?.name || tx.cashierName || 'Kasir'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="block text-sm font-black text-slate-900 dark:text-white">
                            {formatCurrency(Number(tx.total))}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            {tx.paymentMethod}
                          </span>
                        </div>

                        <Badge
                          variant={
                            tx.status === 'PAID'
                              ? 'success'
                              : tx.status === 'PENDING'
                              ? 'warning'
                              : 'danger'
                          }
                        >
                          {tx.status === 'PAID' ? 'Lunas' : tx.status === 'PENDING' ? 'Pending' : 'Batal'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">
                  Belum ada transaksi tercatat hari ini.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Low Stock Alerts */}
        <div>
          <Card className="h-full">
            <CardHeader className="border-slate-100 dark:border-slate-800/60">
              <CardTitle>Stok Menipis</CardTitle>
              <CardDescription>Produk dengan persediaan di bawah batas minimum</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {stockAlerts.length > 0 ? (
                stockAlerts.map((prod) => (
                  <div 
                    key={prod.id} 
                    className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800 rounded-lg flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">{prod.name}</span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        Batas Minimum: {prod.minStockAlert} pcs
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-500/20">
                        Sisa {prod.stock} pcs
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center gap-2 font-medium">
                  <CheckCircleIcon />
                  <span>Semua persediaan stok produk dalam kondisi aman.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="h-8 w-8 text-emerald-500/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
