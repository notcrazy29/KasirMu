'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Building2, 
  ShoppingBag,
  ArrowUpRight
} from 'lucide-react';

interface TimelineStat {
  date: string;
  revenue: number;
  count: number;
  qris: number;
  cash: number;
}

interface Stats {
  userCount: number;
  ownerCount: number;
  cashierCount: number;
  storeCount: number;
  transactionCount: number;
  activeShiftsCount: number;
  totalRevenue: number;
}

export default function SuperAdminReports() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [dailyStats, setDailyStats] = useState<TimelineStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        const res = await api.get('/superadmin/stats');
        setStats(res.stats);
        setDailyStats(res.dailyStats || []);
      } catch (err) {
        console.error('Failed to load reports data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReportData();
  }, []);

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  // Calculate totals
  const totalQris = dailyStats.reduce((sum, item) => sum + item.qris, 0);
  const totalCash = dailyStats.reduce((sum, item) => sum + item.cash, 0);

  const paymentData = [
    { name: 'QRIS', value: totalQris },
    { name: 'Tunai (Cash)', value: totalCash },
  ];

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-blue-500" />
          <span>Laporan Omzet & Pertumbuhan Global</span>
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Grafik visualisasi pendapatan kumulatif, performa transaksi digital, dan tren penggunaan POS.</p>
      </div>

      {/* Top Cards */}
      <div className="grid sm:grid-cols-3 gap-6">
        <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-500 uppercase font-black tracking-wider flex items-center justify-between">
              <span>Total Revenue</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {formatCurrency(stats?.totalRevenue || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <span className="text-emerald-450 font-bold flex items-center">
                <ArrowUpRight className="h-3 w-3" /> +12.5%
              </span>
              <span>dari bulan lalu</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-500 uppercase font-black tracking-wider flex items-center justify-between">
              <span>Total Merchant Terdaftar</span>
              <Building2 className="h-4 w-4 text-blue-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {stats?.storeCount || 0} Toko
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <span className="text-blue-450 font-bold flex items-center">
                <ArrowUpRight className="h-3 w-3" /> +4.2%
              </span>
              <span>merchant baru minggu ini</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-500 uppercase font-black tracking-wider flex items-center justify-between">
              <span>Volume Transaksi Platform</span>
              <ShoppingBag className="h-4 w-4 text-indigo-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {stats?.transactionCount || 0} Struk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <span className="text-indigo-455 font-bold flex items-center">
                <ArrowUpRight className="h-3 w-3" /> +8.1%
              </span>
              <span>transaksi sukses</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Area Chart: Revenue Trend */}
        <Card className="lg:col-span-2 border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/20">
          <CardHeader>
            <CardTitle className="text-sm font-extrabold text-slate-900 dark:text-white">Tren Omzet Platform (7 Hari Terakhir)</CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">Total nilai nominal transaksi berstatus lunas</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDateLabel} 
                  stroke="#64748b" 
                  fontSize={10} 
                />
                <YAxis 
                  tickFormatter={(val) => `Rp ${val / 1000}k`} 
                  stroke="#64748b" 
                  fontSize={10} 
                />
                <Tooltip 
                  labelFormatter={(lbl) => `Tanggal: ${new Date(lbl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}`}
                  formatter={(val) => [formatCurrency(Number(val)), 'Omzet']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '11px', color: '#fff' }}
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
          </CardContent>
        </Card>

        {/* Bar Chart: QRIS vs Cash */}
        <Card className="lg:col-span-1 border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/20">
          <CardHeader>
            <CardTitle className="text-sm font-extrabold text-slate-900 dark:text-white">Metode Pembayaran</CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">Arus omzet berdasarkan tipe QRIS vs Cash</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDateLabel} 
                  stroke="#64748b" 
                  fontSize={10} 
                />
                <YAxis 
                  tickFormatter={(val) => `Rp ${val / 1000}k`} 
                  stroke="#64748b" 
                  fontSize={10} 
                />
                <Tooltip 
                  labelFormatter={(lbl) => `Tanggal: ${new Date(lbl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}`}
                  formatter={(val) => formatCurrency(Number(val))}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '11px', color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="qris" name="QRIS" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cash" name="Tunai" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
