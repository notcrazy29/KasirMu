'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { 
  KeyRound, 
  Coins, 
  TrendingUp, 
  Calendar, 
  LogOut,
  Info
} from 'lucide-react';

interface ActiveShift {
  id: string;
  startTime: string;
  startingCash: string | number;
  totalSales: string | number;
  status: string;
}

export default function CashierShiftPage() {
  const router = useRouter();
  const { currentStoreId, user } = useAuthStore();
  const [shift, setShift] = useState<ActiveShift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [closingCash, setClosingCash] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const fetchActiveShift = async () => {
    if (!currentStoreId) return;
    try {
      const response = await api.get(`/transactions/shifts/active?storeId=${currentStoreId}&userId=${user?.id}`);
      setShift(response.shift);
      
      if (response.shift) {
        // Set default closing cash prediction (starting cash + sales revenue)
        const expected = Number(response.shift.startingCash) + Number(response.shift.totalSales);
        setClosingCash(expected);
      }
    } catch (err) {
      console.error('Failed to load active shift details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveShift();
  }, [currentStoreId]);

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;

    if (!confirm('Apakah Anda yakin ingin MENUTUP SHIFT kasir Anda sekarang? Laci cash drawer akan dikunci.')) return;

    setIsClosing(true);
    try {
      const response = await api.post('/transactions/shifts/end', {
        endingCash: Number(closingCash),
      });
      // Redirect to Shift Closed summary page
      router.push(`/pos/shift-closed?shiftId=${response.shift.id}`);
    } catch (err: any) {
      alert(err.message || 'Gagal menutup shift');
    } finally {
      setIsClosing(false);
    }
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
      <div className="h-full flex items-center justify-center text-slate-400">
        <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  // If cashier navigated here but has no active shift open
  if (!shift) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 mb-4">
          <KeyRound className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Shift Kasir Belum Dibuka</h2>
        <p className="text-slate-600 dark:text-slate-400 text-xs mt-2">
          Anda tidak memiliki shift kasir aktif yang terbuka saat ini.
        </p>
        <Button
          variant="primary"
          className="mt-5 font-bold"
          onClick={() => router.push('/pos')}
        >
          Mulai Transaksi di POS
        </Button>
      </div>
    );
  }

  const expectedEndingCash = Number(shift.startingCash) + Number(shift.totalSales);

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Manajemen Laci Kas</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Audit saldo kas laci cash drawer dan penutupan shift kasir</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column: Active Shift details card */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm p-6 flex flex-col gap-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Info className="h-4.5 w-4.5 text-blue-500" />
            <span>Informasi Shift Aktif</span>
          </h3>

          <div className="flex flex-col gap-3 text-xs">
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <span className="text-slate-500 dark:text-slate-400">Mulai Shift</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>{new Date(shift.startTime).toLocaleString('id-ID')}</span>
              </span>
            </div>

            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <span className="text-slate-500 dark:text-slate-400">Saldo Modal Awal</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(Number(shift.startingCash))}</span>
            </div>

            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <span className="text-slate-500 dark:text-slate-400">Omzet Tunai Shift</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{formatCurrency(Number(shift.totalSales))}</span>
              </span>
            </div>

            <div className="flex justify-between pt-1">
              <span className="text-slate-500 dark:text-slate-400">Estimasi Saldo Laci</span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">{formatCurrency(expectedEndingCash)}</span>
            </div>
          </div>
        </Card>

        {/* Right Column: Close shift drawer entry card */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 shadow-sm p-6">
          <form onSubmit={handleCloseShift} className="flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="h-4.5 w-4.5 text-amber-500" />
              <span>Tutup Buku Laci Kas</span>
            </h3>
            
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              Hitung fisik uang tunai di laci kasir Anda, masukkan jumlahnya di bawah untuk mencocokkan laporan sebelum menutup shift.
            </p>

            <Input
              id="cEndingCash"
              type="number"
              label="Jumlah Uang Fisik Terhitung (IDR)"
              value={closingCash || ''}
              onChange={(e) => setClosingCash(Number(e.target.value))}
              required
            />

            <Button
              type="submit"
              variant="destructive"
              className="w-full mt-2 font-bold flex items-center justify-center gap-1.5"
              isLoading={isClosing}
              disabled={closingCash <= 0}
            >
              <LogOut className="h-4 w-4" />
              <span>Tutup Shift Kasir</span>
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
