'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { 
  TrendingUp, 
  DollarSign, 
  BarChart, 
  UtensilsCrossed, 
  Coins, 
  CalendarClock,
  Users
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface ChartDataPoint {
  date: string;
  revenue: number;
}

interface BestSeller {
  productId: string;
  name: string;
  quantitySold: number;
  totalSalesVal: string | number;
}

interface CashierReport {
  cashierId: string;
  name: string;
  role: string;
  txCount: number;
  revenue: number;
  paymentSplit: { CASH: number; QRIS: number };
}

interface AnalyticsStats {
  summary: {
    totalRevenue: number;
    totalTxCount: number;
    paymentSplit: { CASH: number; QRIS: number };
  };
  salesChartData: ChartDataPoint[];
  bestSellers: BestSeller[];
  cashierReports: CashierReport[];
}

export default function AnalyticsPage() {
  const { currentStoreId } = useAuthStore();
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');

  const fetchAnalytics = async () => {
    if (!currentStoreId) return;
    setIsLoading(true);
    try {
      const response = await api.get(`/analytics/dashboard?storeId=${currentStoreId}&period=${period}`);
      setStats({
        summary: response.summary,
        salesChartData: response.salesChartData,
        bestSellers: response.bestSellers,
        cashierReports: response.cashierReports || [],
      });
    } catch (err) {
      console.error('Failed to load analytics charts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [currentStoreId, period]);

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

  const chartData = stats?.salesChartData || [];
  const bestSellers = stats?.bestSellers || [];
  const summary = stats?.summary || { totalRevenue: 0, totalTxCount: 0, paymentSplit: { CASH: 0, QRIS: 0 } };

  // Calculate averages
  const avgTxValue = summary.totalTxCount > 0 ? summary.totalRevenue / summary.totalTxCount : 0;
  const qrisRatio = summary.totalTxCount > 0 ? (summary.paymentSplit.QRIS / summary.totalTxCount) * 100 : 0;

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Analitik Toko</h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Laporan grafik omzet bulanan dan pemetaan produk terlaris</p>
        </div>

        {/* Timeframe Filter Button Group */}
        <div className="flex bg-slate-150 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 self-start sm:self-auto shadow-sm">
          {(['day', 'week', 'month', 'year'] as const).map((p) => {
            const labels = {
              day: 'Hari Ini',
              week: 'Mingguan',
              month: 'Bulanan',
              year: 'Tahunan',
            };
            const isActive = period === p;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
          <CardContent className="flex items-center gap-4">
            <div className="p-3 bg-blue-600/10 text-blue-500 dark:text-blue-400 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-600 dark:text-slate-300 font-bold block">Rata-rata Nilai Transaksi</span>
              <span className="text-lg font-black text-slate-900 dark:text-white mt-1 block">
                {formatCurrency(avgTxValue)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
          <CardContent className="flex items-center gap-4">
            <div className="p-3 bg-emerald-600/10 text-emerald-500 dark:text-emerald-400 rounded-xl">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-600 dark:text-slate-300 font-bold block">Rasio Pembayaran QRIS</span>
              <span className="text-lg font-black text-slate-900 dark:text-white mt-1 block">
                {qrisRatio.toFixed(1)}% Penjualan
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
          <CardContent className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600/10 text-indigo-500 dark:text-indigo-400 rounded-xl">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-600 dark:text-slate-300 font-bold block">Total Transaksi Selesai</span>
              <span className="text-lg font-black text-slate-900 dark:text-white mt-1 block">
                {summary.totalTxCount} Invoice Lunas
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts section */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart (Span 2) */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20">
            <CardHeader className="border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <CardTitle>Tren Omzet Pendapatan</CardTitle>
              </div>
              <CardDescription>Grafik grafik omzet penjualan 30 hari terakhir</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-80 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#64748b" 
                      />
                      <YAxis stroke="#64748b" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                        formatter={(value: any) => [formatCurrency(Number(value || 0)), 'Pendapatan']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorRevenue)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-80 text-slate-500 text-xs">
                  Belum memiliki riwayat omzet untuk dirender.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bestselling products */}
        <div>
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 h-full">
            <CardHeader className="border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <BarChart className="h-5 w-5 text-indigo-500" />
                <CardTitle>5 Terlaris</CardTitle>
              </div>
              <CardDescription>Peringkat produk berdasarkan unit terjual</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {bestSellers.length > 0 ? (
                bestSellers.map((item, idx) => (
                  <div 
                    key={item.productId} 
                    className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 hover:border-slate-200 dark:hover:border-slate-800 rounded-lg flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 h-6 rounded bg-slate-150 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 text-[10px] font-black text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</span>
                        <span className="block text-[10px] text-slate-600 dark:text-slate-300 mt-1 font-semibold">
                          Total Nilai: {formatCurrency(Number(item.totalSalesVal))}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="text-xs font-extrabold text-blue-500 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                        {item.quantitySold} Porsi
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center gap-2">
                  <UtensilsCrossed className="h-8 w-8 text-indigo-500/20" />
                  <span>Belum ada peringkat terjual.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cashier Performance Report Card */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20">
        <CardHeader className="border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Users className="h-5 w-5 text-blue-500" />
            <CardTitle>Laporan Kinerja & Penjualan Kasir</CardTitle>
          </div>
          <CardDescription>Akumulasi penjualan, kontribusi omzet, dan split metode pembayaran per staf</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {stats?.cashierReports && stats.cashierReports.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-205 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="p-4 pl-6">Nama Staf</th>
                    <th className="p-4 text-center">Transaksi Selesai</th>
                    <th className="p-4 text-right">Penjualan Tunai</th>
                    <th className="p-4 text-right">Penjualan QRIS</th>
                    <th className="p-4 text-right">Total Omzet</th>
                    <th className="p-4 pr-6 w-52">Rasio Kontribusi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.cashierReports.map((c) => {
                    const totalStoreRevenue = summary.totalRevenue || 0;
                    const contributionPct = totalStoreRevenue > 0 ? (c.revenue / totalStoreRevenue) * 100 : 0;
                    return (
                      <tr key={c.cashierId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                        <td className="p-4 pl-6 font-bold text-slate-900 dark:text-white">
                          <div className="flex flex-col">
                            <span>{c.name}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-450 font-normal uppercase mt-0.5 tracking-wider">{c.role}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                          {c.txCount} Invoice
                        </td>
                        <td className="p-4 text-right font-medium text-slate-500 dark:text-slate-400">
                          {formatCurrency(c.paymentSplit.CASH)}
                        </td>
                        <td className="p-4 text-right font-medium text-slate-500 dark:text-slate-400">
                          {formatCurrency(c.paymentSplit.QRIS)}
                        </td>
                        <td className="p-4 text-right font-extrabold text-blue-600 dark:text-blue-400">
                          {formatCurrency(c.revenue)}
                        </td>
                        <td className="p-4 pr-6">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-550" 
                                style={{ width: `${contributionPct}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-600 dark:text-slate-400 w-10 text-right">
                              {contributionPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
              <Users className="h-8 w-8 text-slate-500/20" />
              <span>Tidak ada data laporan kasir untuk periode ini.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
