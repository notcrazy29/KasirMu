'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import ThemeToggle from '@/components/shared/ThemeToggle';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  User,
  History, 
  LogOut, 
  Menu, 
  X,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  FileSpreadsheet,
  TrendingUp,
  Wrench,
  Settings,
  Wifi,
  Sparkles,
} from 'lucide-react';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout, updateUser } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(pathname?.includes('settings') || false);

  // Profile Settings States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      setAdminName(user.name || '');
      setAdminEmail(user.email || '');
    }
  }, [user]);

  // Guards: ensure super admin role
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/super-admin/login');
      } else if (user?.role !== 'SUPER_ADMIN') {
        router.push('/super-admin/login');
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName || !adminEmail) {
      setAdminError('Nama dan Email wajib diisi');
      return;
    }
    setIsSavingAdmin(true);
    setAdminError('');
    setAdminSuccess('');
    try {
      await api.put(`/superadmin/users/${user?.id}`, {
        name: adminName,
        email: adminEmail,
        role: 'SUPER_ADMIN',
        password: adminPassword ? adminPassword : null
      });
      
      updateUser({
        name: adminName,
        email: adminEmail
      });
      
      setAdminSuccess('Profil berhasil diperbarui!');
      setAdminPassword('');
      setTimeout(() => {
        setIsSettingsOpen(false);
        setAdminSuccess('');
      }, 1500);
    } catch (err: any) {
      setAdminError(err.message || 'Gagal memperbarui profil.');
    } finally {
      setIsSavingAdmin(false);
    }
  };

  if (isLoading || !isAuthenticated || user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-semibold tracking-wide text-slate-400">Memuat Sesi Admin...</span>
        </div>
      </div>
    );
  }

  const sidebarLinks = [
    { name: 'Dashboard', path: '/superadmin', icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
    { name: 'Daftar Pengguna', path: '/superadmin/users', icon: <Users className="h-4.5 w-4.5" /> },
    { name: 'Daftar Outlet', path: '/superadmin/stores', icon: <Building2 className="h-4.5 w-4.5" /> },
    { name: 'Validasi Owner', path: '/superadmin/approvals', icon: <ShieldCheck className="h-4.5 w-4.5" /> },
    { name: 'Kelola Langganan Owner', path: '/superadmin/owner-subscriptions', icon: <Sparkles className="h-4.5 w-4.5 text-amber-400" /> },
    { name: 'Paket Langganan', path: '/superadmin/subscriptions', icon: <CreditCard className="h-4.5 w-4.5" /> },
    { name: 'Transaksi Global', path: '/superadmin/transactions', icon: <History className="h-4.5 w-4.5" /> },
    { name: 'Log Aktivitas', path: '/superadmin/logs', icon: <FileSpreadsheet className="h-4.5 w-4.5" /> },
    { name: 'Analitik Global', path: '/superadmin/reports', icon: <TrendingUp className="h-4.5 w-4.5" /> },
    { name: 'Pemeliharaan', path: '/superadmin/maintenance', icon: <Wrench className="h-4.5 w-4.5" /> },
  ];

  return (
    <div className="flex-1 flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-955/80 backdrop-blur-sm lg:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Component */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 border-r border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/40 backdrop-blur-md transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-900">
          <div className="flex items-center gap-2">
            <div className="bg-slate-700 p-2 rounded text-white font-black text-sm">KM</div>
            <span className="text-base font-bold tracking-tight text-white">
              Super<span className="text-slate-400">Admin</span>
            </span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.path;
            return (
              <Link
                key={link.path}
                href={link.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 ${
                  isActive 
                    ? 'bg-slate-800 text-white shadow-lg shadow-slate-950/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                }`}
              >
                {link.icon}
                {link.name}
              </Link>
            );
          })}

          {/* Collapsible Settings Link */}
          <div className="pt-2">
            <button
              onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
              className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                pathname.includes('/settings')
                  ? 'bg-slate-900/40 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <span className="flex items-center gap-3">
                <Settings className="h-4.5 w-4.5" />
                Settings
              </span>
              <span className="text-[10px] text-slate-500 font-black">
                {isSettingsMenuOpen ? '▲' : '▼'}
              </span>
            </button>

            {isSettingsMenuOpen && (
              <div className="pl-6 mt-1.5 space-y-1.5 animate-fadeIn">
                <Link
                  href="/superadmin/settings"
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    pathname === '/superadmin/settings'
                      ? 'bg-slate-800 text-white shadow-md'
                      : 'text-slate-500 hover:text-white hover:bg-slate-900/30'
                  }`}
                >
                  <User className="h-4 w-4 text-blue-500" />
                  My Account
                </Link>
                <Link
                  href="/superadmin/settings/payment-gateway"
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    pathname === '/superadmin/settings/payment-gateway'
                      ? 'bg-slate-800 text-white shadow-md'
                      : 'text-slate-500 hover:text-white hover:bg-slate-900/30'
                  }`}
                >
                  <Wifi className="h-4 w-4 text-emerald-500" />
                  Payment Gateway
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-900">
          <button
            onClick={() => logout()}
            className="flex items-center justify-between w-full px-4 py-3 text-sm font-bold text-red-400 rounded-xl hover:bg-red-950/20 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <LogOut className="h-4.5 w-4.5" />
              Keluar
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-900 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white lg:hidden cursor-pointer"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-850 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              <span>Sesi Administrasi Sistem KasirMu</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-900 text-xs">
              <div className="text-right">
                <span className="block font-bold text-slate-900 dark:text-white leading-none">{user.name}</span>
                <span className="block text-[10px] text-red-500 font-bold uppercase mt-1">Super Admin</span>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Pengaturan Profil"
              >
                <Settings className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Inner page viewports */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 dark:bg-slate-950">
          {children}
        </main>
      </div>

      {/* Dialog Pengaturan Profil Super Admin */}
      <Dialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Pengaturan Profil Super Admin" description="Ubah email login (ID) dan kata sandi akses sistem utama Anda.">
        <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
          {adminError && <div className="p-3 bg-red-955/30 border border-red-500/25 text-red-400 rounded-lg text-xs font-semibold">{adminError}</div>}
          {adminSuccess && <div className="p-3 bg-emerald-955/30 border border-emerald-500/25 text-emerald-400 rounded-lg text-xs font-semibold">{adminSuccess}</div>}
          
          <Input id="admin-name" label="Nama Lengkap *" placeholder="Super Admin" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
          <Input id="admin-email" label="Email Login / ID *" placeholder="admin@example.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
          <Input id="admin-password" label="Kata Sandi Baru (Kosongkan jika tidak diubah)" type="password" placeholder="••••••••" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
          
          <Button type="submit" variant="primary" className="w-full mt-2 font-bold flex justify-center items-center" isLoading={isSavingAdmin}>
            Simpan Perubahan
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
