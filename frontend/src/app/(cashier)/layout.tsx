'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../store/useAuthStore';
import { ShoppingCart, History, KeyRound, LogOut, Lock } from 'lucide-react';
import ThemeToggle from '@/components/shared/ThemeToggle';
import api from '@/lib/api';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [exitPinInput, setExitPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleExitClick = () => {
    setIsPinModalOpen(true);
    setExitPinInput('');
    setPinError('');
  };

  const handleVerifyAndLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.storeId) return;
    setIsVerifying(true);
    setPinError('');
    try {
      const response = await api.post(`/stores/${user.storeId}/verify-pin`, { pin: exitPinInput });
      if (response.valid) {
        setIsPinModalOpen(false);
        logout();
        router.push('/login');
      } else {
        setPinError('PIN keamanan salah! Hubungi Owner toko.');
      }
    } catch (err: any) {
      setPinError(err.message || 'Gagal memverifikasi PIN keamanan');
    } finally {
      setIsVerifying(false);
    }
  };

  // Guard: ensure logged-in and cashier role
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (user?.role !== 'CASHIER') {
        if (user?.role === 'SUPER_ADMIN') {
          router.push('/superadmin');
        } else {
          router.push('/dashboard');
        }
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading || !isAuthenticated || user?.role !== 'CASHIER') {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-semibold tracking-wide text-slate-400">Loading Cashier Session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-850 dark:text-slate-100">
      {/* Cashier Minimal Top Navbar */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded text-white font-black text-xs shrink-0">KM</div>
          <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
            Kasir<span className="text-blue-500">Mu</span> <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-semibold hidden xs:inline">POS</span>
          </span>
        </div>

        {/* Navigation Tabs (Only show if cashier has associated store) */}
        {user?.storeId && (
          <nav className="flex items-center gap-2 sm:gap-6 text-xs font-bold text-slate-800 dark:text-slate-300">
            <Link 
              href="/pos" 
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors min-h-[38px] ${pathname === '/pos' ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-extrabold' : 'hover:text-slate-900 dark:hover:text-white'}`}
            >
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">POS Kasir</span>
              <span className="sm:hidden">POS</span>
            </Link>
            <Link 
              href="/pos/history" 
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors min-h-[38px] ${pathname === '/pos/history' ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-extrabold' : 'hover:text-slate-900 dark:hover:text-white'}`}
            >
              <History className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Riwayat</span>
              <span className="sm:hidden">Riwayat</span>
            </Link>
            <Link 
              href="/pos/shift" 
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors min-h-[38px] ${pathname === '/pos/shift' ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-extrabold' : 'hover:text-slate-900 dark:hover:text-white'}`}
            >
              <KeyRound className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Shift Drawer</span>
              <span className="sm:hidden">Shift</span>
            </Link>
          </nav>
        )}

        {/* User profile & Log out */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs shrink-0">
          <div className="text-right hidden md:block">
            <span className="block font-bold text-slate-900 dark:text-white leading-none">{user?.name}</span>
            <span className="block text-[10px] text-slate-500 font-bold uppercase mt-1">Cashier</span>
          </div>

          <ThemeToggle />

          <button
            onClick={handleExitClick}
            className="text-slate-500 dark:text-slate-400 hover:text-red-650 dark:hover:text-red-400 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Keluar Mode Kasir"
            aria-label="Keluar Mode Kasir"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main viewport */}
      <main className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-slate-950">
        {children}
      </main>

      {/* PIN Verification Modal */}
      <Dialog
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        title="Otorisasi Owner Diperlukan"
        description="Masukkan PIN keamanan outlet untuk keluar dari mode kasir POS."
      >
        <form onSubmit={handleVerifyAndLogout} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              PIN Keamanan Toko
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                type="password"
                required
                maxLength={6}
                placeholder="Masukkan 4-6 digit PIN"
                value={exitPinInput}
                onChange={(e) => setExitPinInput(e.target.value.replace(/\D/g, ''))}
                className="pl-9 text-center tracking-[0.5em] font-extrabold text-sm"
              />
            </div>
            {pinError && (
              <span className="text-[11px] text-rose-500 font-semibold">{pinError}</span>
            )}
          </div>

          <div className="flex gap-2 justify-end mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsPinModalOpen(false)}
              className="text-xs font-bold"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isVerifying || exitPinInput.length < 4}
              className="text-xs font-bold flex items-center justify-center gap-1.5"
            >
              {isVerifying ? 'Memverifikasi...' : 'Verifikasi & Keluar'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
