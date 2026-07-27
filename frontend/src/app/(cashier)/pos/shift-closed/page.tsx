'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { 
  CheckCircle2, 
  Calendar, 
  Clock, 
  User, 
  Hash, 
  Coins, 
  TrendingUp, 
  PiggyBank, 
  AlertTriangle, 
  LogOut, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface Shift {
  id: string;
  startTime: string;
  endTime: string;
  startingCash: string | number;
  endingCash: string | number;
  totalSales: string | number;
  status: string;
  user: {
    name: string;
    email: string;
  };
}

interface NextCashierSchedule {
  id: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  status: string;
  cashier: {
    id: string;
    name: string;
    email: string;
    username: string;
    profileImage: string | null;
    isOnline: boolean;
  };
}

export default function ShiftClosedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shiftId = searchParams.get('shiftId');
  const { currentStoreId, logout } = useAuthStore();

  const [shift, setShift] = useState<Shift | null>(null);
  const [nextSchedules, setNextSchedules] = useState<NextCashierSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchShiftData = async () => {
    if (!currentStoreId || !shiftId) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch closed shift details
      const shiftRes = await api.get(`/transactions/shifts?storeId=${currentStoreId}`);
      const foundShift = shiftRes.shifts.find((s: any) => s.id === shiftId);
      if (foundShift) {
        setShift(foundShift);
      }

      // 2. Fetch upcoming cashier schedules
      const nextRes = await api.get(`/transactions/shifts/next-cashiers?storeId=${currentStoreId}`);
      setNextSchedules(nextRes.schedules);
    } catch (err) {
      console.error('Failed to load shift closed data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShiftData();
  }, [currentStoreId, shiftId]);

  const handleLogout = async () => {
    try {
      await api.post('/sessions/logout', {});
    } catch (e) {
      console.error(e);
    }
    logout();
    router.push('/login');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <svg className="animate-spin h-6 w-6 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Memuat ringkasan audit shift...</span>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 text-center p-6 max-w-sm mx-auto">
        <div className="bg-red-500/10 p-4 rounded-full text-red-500 mb-4 animate-bounce">
          <AlertTriangle className="h-10 w-10" />
        </div>
        <h2 className="text-base font-bold text-white">Ringkasan Shift Tidak Ditemukan</h2>
        <p className="text-slate-500 text-xs mt-2">
          Gagal mendapatkan detail audit shift yang baru saja ditutup. Silakan log out secara manual.
        </p>
        <Button variant="primary" className="mt-5 font-bold" onClick={handleLogout}>
          Keluar (Logout)
        </Button>
      </div>
    );
  }

  // Math
  const startCash = Number(shift.startingCash);
  const sales = Number(shift.totalSales);
  const endCashActual = Number(shift.endingCash);
  const expectedEndCash = startCash + sales;
  const difference = endCashActual - expectedEndCash;

  // Status Audit
  let auditStatusText = 'Balance / Cocok';
  let auditStatusColor = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
  if (difference > 0) {
    auditStatusText = 'Surplus / Lebih';
    auditStatusColor = 'bg-amber-500/15 text-amber-400 border border-amber-500/20';
  } else if (difference < 0) {
    auditStatusText = 'Shortage / Kurang';
    auditStatusColor = 'bg-rose-500/15 text-rose-400 border border-rose-500/20';
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10 flex flex-col gap-8 max-w-5xl mx-auto overflow-y-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/15 p-1.5 rounded-lg text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">Shift Berhasil Ditutup</h1>
          </div>
          <p className="text-xs text-slate-450 mt-1">Laci cash drawer kasir telah dikunci dan data audit telah tercatat.</p>
        </div>
        <Button variant="destructive" onClick={handleLogout} className="font-bold flex items-center gap-1.5 shadow-md">
          <LogOut className="h-4 w-4" />
          <span>Keluar Sesi</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Shift Audit summary details (Span 2) */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <Card className="border-slate-800 bg-white/5 dark:bg-slate-900/10 backdrop-blur shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                <span>Rincian Laporan Audit Kas</span>
              </CardTitle>
              <CardDescription>Perbandingan jumlah modal awal, omzet tunai, dan hitung fisik akhir</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="flex flex-col gap-3.5 bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <span className="text-slate-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Tanggal</span>
                  <span className="font-bold text-slate-200">
                    {new Date(shift.endTime).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <span className="text-slate-500 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-slate-400" /> Jam Selesai</span>
                  <span className="font-bold text-slate-200">
                    {new Date(shift.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <span className="text-slate-500 flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-400" /> Operator Kasir</span>
                  <span className="font-bold text-slate-200">{shift.user.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-slate-400" /> Nomor Shift</span>
                  <span className="font-bold text-slate-350 font-mono">#{shift.id.slice(0, 8)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3.5 bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <span className="text-slate-500 flex items-center gap-1.5"><Coins className="h-3.5 w-3.5 text-slate-400" /> Saldo Awal</span>
                  <span className="font-bold text-slate-200">{formatCurrency(startCash)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <span className="text-slate-500 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-slate-400" /> Omzet Tunai</span>
                  <span className="font-extrabold text-emerald-400">{formatCurrency(sales)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <span className="text-slate-500 flex items-center gap-1.5"><PiggyBank className="h-3.5 w-3.5 text-slate-400" /> Saldo Akhir Fisik</span>
                  <span className="font-bold text-slate-200">{formatCurrency(endCashActual)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Selisih Kas</span>
                  <span className={`font-black ${difference === 0 ? 'text-emerald-450' : difference > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2 bg-slate-900/60 p-4 rounded-xl border border-slate-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-slate-500 block font-bold">Status Audit Kas Laci</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Hasil sinkronisasi data transaksi fisik dengan laporan virtual</span>
                </div>
                <span className={`px-3.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${auditStatusColor}`}>
                  {auditStatusText}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Next Cashier lists */}
        <div>
          <Card className="border-slate-800 bg-white/5 dark:bg-slate-900/10 backdrop-blur shadow-xl h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-sm">Kasir Shift Berikutnya</CardTitle>
              <CardDescription className="text-[10px]">Petugas kasir terjadwal hari ini yang bersiap bertugas</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3">
              {nextSchedules.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {nextSchedules.map((schedule) => {
                    // Operational time formatting
                    const startH = new Date(schedule.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const endH = new Date(schedule.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    
                    // Status mapping
                    let statusLabel = 'Offline';
                    let statusDot = 'bg-slate-500';
                    if (schedule.status === 'FINISHED') {
                      statusLabel = 'Shift Selesai';
                      statusDot = 'bg-rose-500';
                    } else if (schedule.cashier.isOnline) {
                      statusLabel = 'Online';
                      statusDot = 'bg-emerald-500 animate-pulse';
                    }

                    return (
                      <div 
                        key={schedule.id} 
                        className="bg-slate-900/40 p-3 rounded-xl border border-slate-850/80 flex flex-col gap-3 hover:border-slate-800 transition-colors"
                      >
                        <div className="flex gap-2.5 items-center">
                          {schedule.cashier.profileImage ? (
                            <img 
                              src={schedule.cashier.profileImage} 
                              alt={schedule.cashier.name} 
                              className="w-9 h-9 rounded-full object-cover border border-slate-800 shrink-0" 
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-blue-600/15 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {schedule.cashier.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-slate-100 truncate">{schedule.cashier.name}</span>
                            <span className="block text-[9px] text-slate-500 font-mono mt-0.5">Pegawai ID: {schedule.cashier.username || schedule.cashier.email.split('@')[0]}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 border-t border-slate-850 pt-2 text-[10px] text-slate-400">
                          <div className="flex justify-between">
                            <span>Jam Operasional:</span>
                            <span className="font-bold text-slate-200">{startH} - {endH}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Status:</span>
                            <div className="flex items-center gap-1.5 font-bold">
                              <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                              <span>{statusLabel}</span>
                            </div>
                          </div>
                        </div>

                        <Button 
                          variant="primary" 
                          size="sm" 
                          onClick={handleLogout}
                          className="w-full text-[10px] py-1.5 font-bold flex items-center justify-center gap-1"
                        >
                          <span>Masuk Tugas (Login)</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 gap-2 border border-dashed border-slate-900 rounded-2xl">
                  <span className="text-[11px] font-bold text-slate-400">Tidak ada kasir lain yang dijadwalkan.</span>
                  <span className="text-[9px] text-slate-600">Semua shift terjadwal hari ini di outlet ini telah selesai atau belum dibuat.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
