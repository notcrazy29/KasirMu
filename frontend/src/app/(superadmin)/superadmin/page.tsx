'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { 
  Building2, 
  Users, 
  DollarSign, 
  Layers, 
  History,
  TrendingUp
} from 'lucide-react';

interface Stats {
  userCount: number;
  storeCount: number;
  transactionCount: number;
  activeShiftsCount: number;
  totalRevenue: number;
}

interface RecentTx {
  id: string;
  transactionNumber: string;
  total: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  cashier: { name: string };
  store: { name: string };
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentTx, setRecentTx] = useState<RecentTx[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/superadmin/stats');
        setStats(response.stats);
        setRecentTx(response.recentTransactions || []);
      } catch (error) {
        console.error('Failed to fetch superadmin stats:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Pengguna',
      value: stats?.userCount || 0,
      description: 'Owner, Kasir, dan Administrator',
      icon: <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      bg: 'bg-indigo-500/5',
      border: 'border-indigo-500/10',
    },
    {
      title: 'Total Toko / Outlet',
      value: stats?.storeCount || 0,
      description: 'Mitra merchant terdaftar',
      icon: <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
      bg: 'bg-blue-500/5',
      border: 'border-blue-500/10',
    },
    {
      title: 'Omzet Global Platform',
      value: formatCurrency(stats?.totalRevenue || 0),
      description: 'Total transaksi lunas',
      icon: <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
      bg: 'bg-emerald-500/5',
      border: 'border-emerald-500/10',
    },
    {
      title: 'Shift Aktif',
      value: stats?.activeShiftsCount || 0,
      description: 'Kasir melayani pembeli live',
      icon: <Layers className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      bg: 'bg-amber-500/5',
      border: 'border-amber-500/10',
    },
  ];

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <span>Ringkasan Platform</span>
          <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-semibold">Live</span>
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Pantau performa, transaksi, dan pertumbuhan merchant terdaftar.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((card, i) => (
          <Card key={i} className={`border ${card.border} ${card.bg} bg-white dark:bg-slate-900/30 transition-all hover:scale-[1.01]`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{card.title}</CardTitle>
              <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-lg">{card.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{card.value}</div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid: Revenue Overview & Recent Activity */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Welcome & Info */}
        <Card className="lg:col-span-1 border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-slate-900/10 p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Performa Sistem
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Anda masuk sebagai Super Administrator. Di portal ini, Anda memiliki kendali penuh untuk mengelola pengguna, mendaftarkan outlet baru, mengedit status database, dan memantau kelancaran transaksi QRIS serta integrasi Midtrans.
            </p>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-900 pt-6 space-y-4">
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase">Log Transaksi Sistem</span>
              <span className="block text-xl font-bold text-slate-900 dark:text-white mt-1">{stats?.transactionCount || 0}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase">Rasio Sukses Callback</span>
              <span className="block text-xs font-semibold text-emerald-500 dark:text-emerald-400 mt-1">99.98% (Sangat Baik)</span>
            </div>
          </div>
        </Card>

        {/* Recent Transactions list */}
        <Card className="lg:col-span-2 border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/10">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-extrabold text-slate-900 dark:text-white">Transaksi Sistem Terbaru</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">Aktivitas struk belanja global merchant</CardDescription>
            </div>
            <History className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          </CardHeader>
          <CardContent>
            {recentTx.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">Belum ada transaksi di platform.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-bold text-slate-550 dark:text-slate-400 border-b border-slate-100 dark:border-slate-900">
                    <tr>
                      <th className="px-4 py-3">No Transaksi</th>
                      <th className="px-4 py-3">Outlet</th>
                      <th className="px-4 py-3">Kasir</th>
                      <th className="px-4 py-3">Metode</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900/50">
                    {recentTx.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{tx.transactionNumber}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{tx.store.name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{tx.cashier.name}</td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{tx.paymentMethod}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(Number(tx.total))}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            tx.status === 'PAID' 
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/10' 
                              : 'bg-amber-950 text-amber-400 border border-amber-500/10'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
