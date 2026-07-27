'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { useSubscriptionStore } from '../../store/useSubscriptionStore';
import { useSocket } from '@/hooks/useSocket';

import ThemeToggle from '@/components/shared/ThemeToggle';
import { 
  LayoutDashboard, 
  Package, 
  History, 
  BarChart3, 
  Users, 
  QrCode, 
  LogOut, 
  Building2,
  ChevronDown,
  Menu,
  X,
  Store,
  Plus,
  CreditCard,
  Activity,
  Settings,
  Sparkles,
  Check,
  User,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import Input from '../../components/ui/Input';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, stores, currentStoreId, isAuthenticated, isLoading, switchStore, logout, login } = useAuthStore();
  const { fetchSubscription, reset: resetSubscription, isPremium, isInitialized, canClaimTrial, claimTrial } = useSubscriptionStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCreateStoreOpen, setIsCreateStoreOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);

  const [isTrialClaimOpen, setIsTrialClaimOpen] = useState(false);
  const [nikInput, setNikInput] = useState('');
  const [trialStep, setTrialStep] = useState<'WELCOME' | 'INPUT_NIK' | 'SUCCESS'>('WELCOME');
  const [trialError, setTrialError] = useState('');
  const [agreement1, setAgreement1] = useState(false);
  const [agreement2, setAgreement2] = useState(false);
  const [agreement3, setAgreement3] = useState(false);

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nikInput.length !== 16) return;
    setTrialError('');
    try {
      await claimTrial(nikInput);
      setTrialStep('SUCCESS');
    } catch (err: any) {
      setTrialError(err.message || 'Gagal mengklaim trial premium. Coba lagi.');
    }
  };

  // Show welcome popup if owner can claim trial and hasn't dismissed it
  useEffect(() => {
    if (isInitialized && canClaimTrial) {
      const dismissed = sessionStorage.getItem('kasirmu_trial_popup_dismissed');
      if (!dismissed) {
        setIsTrialClaimOpen(true);
        setTrialStep('WELCOME');
      }
    }
  }, [isInitialized, canClaimTrial]);


  const handleStopImpersonating = () => {
    const originalToken = localStorage.getItem('kasirmu_original_token');
    const originalUserStr = localStorage.getItem('kasirmu_original_user');
    const originalStoresStr = localStorage.getItem('kasirmu_original_stores');
    
    if (originalToken && originalUserStr) {
      const originalUser = JSON.parse(originalUserStr);
      const originalStores = originalStoresStr ? JSON.parse(originalStoresStr) : [];
      
      localStorage.removeItem('kasirmu_original_token');
      localStorage.removeItem('kasirmu_original_user');
      localStorage.removeItem('kasirmu_original_stores');
      
      login(originalUser, originalToken, originalStores);
      router.push('/superadmin');
    }
  };

  // Initialize subscription info for owner
  useEffect(() => {
    if (isAuthenticated && user?.role === 'OWNER') {
      fetchSubscription();
    }
    return () => {
      if (!isAuthenticated) resetSubscription();
    };
  }, [isAuthenticated, user?.role]);

  // Layout-level subscription Socket.IO listeners
  // These ensure realtime subscription state changes propagate across ALL dashboard pages
  const socket = useSocket();
  useEffect(() => {
    if (!socket?.isConnected || user?.role !== 'OWNER') return;

    const onUpgraded = () => {
      fetchSubscription();
    };
    const onExpired = () => {
      fetchSubscription();
    };

    socket.on('subscription_upgraded', onUpgraded);
    socket.on('subscription_expired', onExpired);
    socket.on('subscription_overridden', onUpgraded);

    return () => {
      socket.off('subscription_upgraded', onUpgraded);
      socket.off('subscription_expired', onExpired);
      socket.off('subscription_overridden', onUpgraded);
    };
  }, [socket?.isConnected, user?.role, fetchSubscription]);

  // Guards
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (user?.role !== 'OWNER') {
        if (user?.role === 'SUPER_ADMIN') {
          router.push('/superadmin');
        } else {
          router.push('/pos');
        }
      } else if (user?.status !== 'ACTIVE') {
        router.push('/pending-approval');
      }
    }
  }, [isAuthenticated, isLoading, user, router]);


  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName) return;

    try {
      const response = await api.post('/stores', {
        name: newStoreName,
        address: newStoreAddress,
      });

      // Refetch user/stores to update list
      const freshStores = [...stores, response.store];
      if (user) {
        login(user, localStorage.getItem('kasirmu_token') || '', freshStores);
        switchStore(response.store.id);
      }
      
      setIsCreateStoreOpen(false);
      setNewStoreName('');
      setNewStoreAddress('');
    } catch (err) {
      console.error('Failed to create store:', err);
    }
  };

  if (isLoading || !isAuthenticated || user?.role !== 'OWNER') {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-semibold tracking-wide text-slate-400">Loading Session...</span>
        </div>
      </div>
    );
  }

  const activeStore = stores.find((s) => s.id === currentStoreId) || stores[0];

  const sidebarLinks = [
    { name: 'Ringkasan', path: '/dashboard', icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
    { name: 'Produk', path: '/dashboard/products', icon: <Package className="h-4.5 w-4.5" /> },
    { name: 'Transaksi Live', path: '/dashboard/transactions', icon: <History className="h-4.5 w-4.5" /> },
    { name: 'Analitik', path: '/dashboard/analytics', icon: <BarChart3 className="h-4.5 w-4.5" /> },
    { name: 'Kasir', path: '/dashboard/cashiers', icon: <Users className="h-4.5 w-4.5" /> },
    { name: 'Kasir Aktif', path: '/dashboard/cashiers/active', icon: <Activity className="h-4.5 w-4.5" /> },
    { name: 'QR Pairing', path: '/dashboard/pairing', icon: <QrCode className="h-4.5 w-4.5" /> },
    { name: 'Payment Gateway', path: '/dashboard/settings/payment-gateway', icon: <CreditCard className="h-4.5 w-4.5" />, proOnly: true },
    { name: 'Pengaturan Pajak', path: '/dashboard/settings/tax', icon: <Settings className="h-4.5 w-4.5" /> },
    { name: 'Profil & Keamanan', path: '/dashboard/settings/profile', icon: <User className="h-4.5 w-4.5" /> },
    { name: 'Langganan', path: '/dashboard/subscription', icon: <CreditCard className="h-4.5 w-4.5" /> },
  ];

  const filteredLinks = sidebarLinks.filter(
    (link) => !((link as any).proOnly && isInitialized && !isPremium)
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950">
      {/* Impersonation Session Banner */}
      {user?.impersonatedBy && (
        <div className="bg-amber-500 text-slate-950 font-bold px-6 py-2.5 text-xs flex justify-between items-center z-50 shrink-0 border-b border-amber-600/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
            <span>Mode Impersonasi: Anda masuk sebagai Owner (${user.name})</span>
          </div>
          <button
            onClick={handleStopImpersonating}
            className="bg-slate-950 text-amber-500 hover:bg-slate-900 px-3.5 py-1.5 rounded-lg font-black transition-colors cursor-pointer"
          >
            Kembali ke Admin
          </button>
        </div>
      )}
      
      <div className="flex-1 flex h-full bg-slate-950 overflow-hidden text-slate-100">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0">
        {/* Brand */}
        <div className="p-6 flex items-center gap-2 border-b border-slate-800/80">
          <div className="bg-blue-600 p-1.5 rounded text-white font-black text-sm">KM</div>
          <span className="font-bold text-white tracking-wide">Kasir<span className="text-blue-500">Mu</span> Owner</span>
        </div>

        {/* Store Context Switcher */}
        <div className="px-4 py-4 relative border-b border-slate-800/50">
          {stores.length > 0 ? (
            <div>
              <button
                onClick={() => setIsStoreDropdownOpen(!isStoreDropdownOpen)}
                className="w-full flex items-center justify-between bg-slate-950 border border-slate-800 hover:border-slate-700 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <Store className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="truncate">{activeStore?.name || 'Pilih Toko'}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
              </button>

              {isStoreDropdownOpen && (
                <div className="absolute top-[82px] left-4 right-4 z-50 bg-slate-900 border border-slate-800 shadow-xl rounded-lg p-1 animate-zoom-in">
                  <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                    {stores.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          switchStore(s.id);
                          setIsStoreDropdownOpen(false);
                          router.refresh();
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer truncate flex items-center gap-2 ${
                          s.id === currentStoreId ? 'text-blue-400 bg-slate-950/40' : 'text-slate-300'
                        }`}
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-slate-800/80 mt-1 pt-1">
                    <button
                      onClick={() => {
                        setIsStoreDropdownOpen(false);
                        setIsCreateStoreOpen(true);
                      }}
                      className="w-full flex items-center gap-1.5 justify-center px-3 py-2 text-xs font-bold text-blue-500 hover:bg-blue-600/10 rounded-md transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Buat Toko Baru</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="primary"
              className="w-full flex items-center justify-center gap-1 text-xs font-bold"
              onClick={() => setIsCreateStoreOpen(true)}
            >
              <Plus className="h-4 w-4" /> Buat Toko Pertama
            </Button>
          )}
        </div>

        {/* Links */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {filteredLinks.map((link) => {
            const isActive = pathname === link.path;
            const isLocked = (link as any).proOnly && isInitialized && !isPremium;
            return (
              <Link
                key={link.path}
                href={link.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border-l-4 border-blue-500 pl-3'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                {link.icon}
                <span className="flex-1">{link.name}</span>
                {isLocked && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-wider">
                    PRO
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-2 truncate">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-750 flex items-center justify-center text-xs font-bold text-slate-300 uppercase">
                {user?.name.slice(0, 2)}
              </div>
              <div className="truncate">
                <span className="block text-xs font-bold text-white truncate">{user?.name}</span>
                <span className="block text-[10px] text-slate-500 uppercase font-black">{user?.role}</span>
              </div>
            </div>
            <ThemeToggle />
          </div>
          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="w-full flex items-center gap-2 justify-center px-4 py-2 text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header Mobile */}
        <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-bold text-white text-sm">KasirMu</span>
          </div>

          <span className="text-xs font-bold text-blue-400 truncate max-w-[150px]">
            {activeStore?.name || 'KasirMu'}
          </span>
        </header>

        {/* Mobile Drawer Sidebar */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
            <aside className="relative w-64 bg-slate-900 h-full flex flex-col border-r border-slate-800 animate-zoom-in">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <span className="font-bold text-white">Menu KasirMu</span>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile links */}
              <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
                {filteredLinks.map((link) => {
                  const isActive = pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      href={link.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-blue-600/15 text-blue-400 border-l-4 border-blue-500 pl-3'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                      }`}
                    >
                      {link.icon}
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Mobile Logout */}
              <div className="p-4 border-t border-slate-800">
                <button
                  onClick={() => {
                    logout();
                    router.push('/login');
                  }}
                  className="w-full flex items-center gap-2 justify-center px-4 py-2 text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Keluar Akun</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Content Render */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8">
          {canClaimTrial && (
            <div className="mb-6 p-4 rounded-xl border border-amber-300 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-zoom-in">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500/10 p-2 rounded-lg text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Bonus Premium Menanti Anda!</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">Dapatkan Paket Premium Uji Coba gratis selama 30 hari sekarang.</p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="font-bold flex items-center gap-1.5 shrink-0"
                onClick={() => {
                  setNikInput('');
                  setAgreement1(false);
                  setAgreement2(false);
                  setAgreement3(false);
                  setTrialError('');
                  setTrialStep('INPUT_NIK');
                  setIsTrialClaimOpen(true);
                }}
              >
                🎁 Klaim Bonus Premium 30 Hari
              </Button>
            </div>
          )}

          {stores.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-blue-600/10 text-blue-400 flex items-center justify-center mb-6">
                <Building2 className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-extrabold text-white">Belum Ada Toko Terdaftar</h2>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Anda perlu membuat toko pertama Anda sebelum dapat menambah produk, mengaktifkan pairing kasir, dan menerima pembayaran QRIS.
              </p>
              <Button
                variant="primary"
                className="mt-6 font-bold"
                onClick={() => setIsCreateStoreOpen(true)}
              >
                Buat Toko Sekarang
              </Button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Modal Buat Toko */}
      <Dialog
        isOpen={isCreateStoreOpen}
        onClose={() => setIsCreateStoreOpen(false)}
        title="Buat Toko Baru"
        description="Daftarkan outlet / cabang baru untuk operasional KasirMu"
      >
        <form onSubmit={handleCreateStore} className="flex flex-col gap-4">
          <Input
            id="storeName"
            type="text"
            label="Nama Toko"
            placeholder="KopiMu Semarang"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            required
          />
          <Input
            id="storeAddress"
            type="text"
            label="Alamat Toko"
            placeholder="Jl. Pemuda No. 12, Semarang"
            value={newStoreAddress}
            onChange={(e) => setNewStoreAddress(e.target.value)}
          />
          <div className="flex gap-3 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateStoreOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="font-bold"
              disabled={!newStoreName}
            >
              Simpan Toko
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal Klaim Bonus Premium */}
      <Dialog
        isOpen={isTrialClaimOpen}
        onClose={() => {
          sessionStorage.setItem('kasirmu_trial_popup_dismissed', 'true');
          setIsTrialClaimOpen(false);
        }}
        title={trialStep === 'SUCCESS' ? '🎉' : '🎁 Klaim Bonus Premium 30 Hari'}
        description={
          trialStep === 'SUCCESS'
            ? 'Selamat!'
            : 'Selamat datang di KasirMu POS. Sebagai pengguna baru, Anda berhak mendapatkan Bonus Premium GRATIS selama 30 hari. Bonus Premium hanya dapat diklaim satu kali untuk setiap identitas yang valid. Silakan masukkan NIK Anda untuk proses validasi.'
        }
      >
        {trialStep === 'INPUT_NIK' && (
          <form onSubmit={handleClaimSubmit} className="flex flex-col gap-5 pt-3">
            <Input
              id="nik"
              type="text"
              label="NIK (16 Digit)"
              placeholder="Masukkan NIK 16 digit angka"
              value={nikInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, ''); // Numbers only
                if (val.length <= 16) setNikInput(val);
              }}
              required
            />

            {/* Persetujuan Pengguna */}
            <div className="flex flex-col gap-3 mt-1 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer select-none text-xs text-slate-300 hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={agreement1}
                  onChange={(e) => setAgreement1(e.target.checked)}
                  className="mt-0.5 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-blue-500"
                />
                <span>Saya menyatakan bahwa NIK yang saya masukkan adalah benar dan milik saya sendiri.</span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer select-none text-xs text-slate-300 hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={agreement2}
                  onChange={(e) => setAgreement2(e.target.checked)}
                  className="mt-0.5 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-blue-500"
                />
                <span>Saya memahami bahwa Bonus Premium hanya dapat diklaim satu kali untuk setiap identitas yang valid.</span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer select-none text-xs text-slate-300 hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={agreement3}
                  onChange={(e) => setAgreement3(e.target.checked)}
                  className="mt-0.5 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  Saya menyetujui{' '}
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); window.open('/terms', '_blank'); }}
                    className="text-blue-500 hover:underline hover:text-blue-450 font-bold"
                  >
                    Syarat & Ketentuan
                  </a>{' '}
                  serta{' '}
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); window.open('/privacy', '_blank'); }}
                    className="text-blue-500 hover:underline hover:text-blue-450 font-bold"
                  >
                    Kebijakan Privasi
                  </a>{' '}
                  KasirMu POS.
                </span>
              </label>
            </div>

            {trialError && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/25 text-rose-400 rounded-lg text-xs font-semibold">
                {trialError}
              </div>
            )}

            <div className="flex gap-3 justify-end mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  sessionStorage.setItem('kasirmu_trial_popup_dismissed', 'true');
                  setIsTrialClaimOpen(false);
                }}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="font-bold flex items-center gap-1.5"
                disabled={nikInput.length !== 16 || !agreement1 || !agreement2 || !agreement3}
              >
                <Sparkles className="h-4 w-4" />
                Aktifkan Bonus Premium
              </Button>
            </div>
          </form>
        )}

        {trialStep === 'SUCCESS' && (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 animate-bounce text-xl font-bold">
              🎉
            </div>
            <p className="text-sm font-bold text-slate-200">
              Bonus Premium Anda telah aktif selama 30 hari.
            </p>
            <Button
              type="button"
              variant="primary"
              className="w-full mt-4 font-bold"
              onClick={() => setIsTrialClaimOpen(false)}
            >
              Mulai Menggunakan Premium
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  </div>
  );
}
