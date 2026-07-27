'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import useSocket from '@/hooks/useSocket';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { 
  Users, 
  Monitor, 
  Smartphone, 
  Globe, 
  Clock, 
  LogOut, 
  ShieldAlert, 
  RefreshCw,
  Play,
  Moon
} from 'lucide-react';

interface CashierItem {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
  lastSeen?: string | null;
  storeLogo?: string | null; // Google profile photo is mapped here
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  ipAddress?: string | null;
  loginTime?: string | null;
  lastActivity?: string | null;
  shiftStatus?: 'OPEN' | 'CLOSED';
}

export default function ActiveCashiersPage() {
  const [cashiers, setCashiers] = useState<CashierItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { on, off } = useSocket();

  const fetchActiveCashiers = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/users/online');
      setCashiers(res.cashiers || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal memuat status kasir online.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveCashiers();
  }, []);

  // Listen to realtime online status changes via WebSockets
  useEffect(() => {
    on('online_status', (data: { userId: string; isOnline: boolean; lastSeen?: string }) => {
      console.log('[Socket Event] online_status received:', data);
      // Auto re-fetch to get complete active session device/browser details silently
      fetchActiveCashiers(true);
    });

    return () => {
      off('online_status');
    };
  }, [on, off]);

  const handleForceLogout = async (cashierId: string, cashierName: string) => {
    if (!confirm(`Apakah Anda yakin ingin mengeluarkan paksa (force logout) kasir ${cashierName}?`)) {
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.post('/users/force-logout', { cashierId });
      setSuccessMsg(`Kasir ${cashierName} berhasil dikeluarkan dari semua sesi.`);
      fetchActiveCashiers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengeluarkan kasir.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatLastSeen = (dateStr?: string | null) => {
    if (!dateStr) return 'Belum pernah aktif';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Kemarin';
    }

    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    }) + ' WIB';
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-500" />
            <span>Kasir Aktif & Status Realtime</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Pantau kasir yang sedang online di outlet Anda secara realtime dan kelola sesi mereka.
          </p>
        </div>
        <Button
          onClick={() => fetchActiveCashiers()}
          variant="outline"
          className="border-slate-300 dark:border-slate-800 flex items-center gap-1.5 font-bold cursor-pointer"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Segarkan Data
        </Button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Cashiers List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-500"></div>
        </div>
      ) : cashiers.length === 0 ? (
        <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/10 py-12 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <Users className="h-8 w-8 text-slate-400" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Belum Ada Akun Kasir</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">Silakan buat akun kasir di menu manajemen staff terlebih dahulu.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cashiers.map((cashier) => (
            <Card 
              key={cashier.id} 
              className={`border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/30 transition-all ${
                cashier.isOnline 
                  ? 'ring-1 ring-emerald-500/20 dark:ring-emerald-500/10 border-emerald-350 dark:border-emerald-900' 
                  : ''
              }`}
            >
              <CardContent className="pt-6 flex flex-col gap-5">
                {/* Header Profile */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-850 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800">
                        {cashier.storeLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cashier.storeLogo} alt={cashier.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-bold text-slate-600 dark:text-slate-350 text-sm">
                            {cashier.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-950 ${
                        cashier.isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-450'
                      }`} />
                    </div>
                    
                    {/* Name & Email */}
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm leading-tight">
                        {cashier.name}
                      </h3>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">{cashier.email}</span>
                      
                      {/* Active Shift Indicator */}
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded mt-1.5 ${
                        cashier.shiftStatus === 'OPEN' 
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900' 
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-850'
                      }`}>
                        Shift: {cashier.shiftStatus === 'OPEN' ? 'Sedang Berjalan (OPEN)' : 'Tutup (CLOSED)'}
                      </span>
                    </div>
                  </div>

                  {/* Online/Offline Status Indicator */}
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${
                    cashier.isOnline 
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900' 
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-850'
                  }`}>
                    {cashier.isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                <hr className="border-slate-100 dark:border-slate-850" />

                {/* Session Details */}
                <div className="flex flex-col gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                  {cashier.isOnline && cashier.device ? (
                    <>
                      <div className="flex items-center gap-2">
                        {cashier.device?.includes('Mobile') ? (
                          <Smartphone className="h-4 w-4 text-slate-450 shrink-0" />
                        ) : (
                          <Monitor className="h-4 w-4 text-slate-450 shrink-0" />
                        )}
                        <span>{cashier.device || 'Perangkat'} | {cashier.browser || 'Browser'} ({cashier.os || 'OS'})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-slate-450 shrink-0" />
                        <span>IP: {cashier.ipAddress || '127.0.0.1'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-450 shrink-0" />
                        <span>Login Sejak: {formatTime(cashier.loginTime)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Play className="h-4 w-4 text-slate-450 shrink-0 animate-pulse text-emerald-500" />
                        <span>Aktivitas Terakhir: {formatLastSeen(cashier.lastActivity)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="py-2.5 text-center bg-slate-50/50 dark:bg-slate-950/20 rounded-lg border border-slate-100 dark:border-slate-850 text-[11px] text-slate-500 flex flex-col gap-1 items-center justify-center">
                      <Moon className="h-4 w-4 text-slate-400" />
                      <span>{formatLastSeen(cashier.lastSeen)}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {cashier.isOnline && (
                  <div className="border-t border-slate-100 dark:border-slate-850 pt-3 mt-1.5 flex flex-col gap-1">
                    <Button
                      onClick={() => handleForceLogout(cashier.id, cashier.name)}
                      variant="destructive"
                      className="w-full flex items-center justify-center gap-1.5 font-bold text-xs py-2 bg-red-600! hover:bg-red-700! text-white border-none cursor-pointer rounded-lg"
                      disabled={isSubmitting}
                    >
                      <LogOut className="h-4 w-4" />
                      Putuskan Sesi (Reset)
                    </Button>
                    <span className="text-[10px] text-slate-400 text-center block">
                      Memungkinkan akun kasir ini login pada perangkat baru.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
