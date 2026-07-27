'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Lock, User, ShieldAlert, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { getDeviceInfo } from '@/lib/device';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identifier || !identifier.trim()) {
      setError('Username atau Email wajib diisi.');
      return;
    }

    if (!password) {
      setError('Password wajib diisi.');
      return;
    }

    setIsLoading(true);

    try {
      const deviceInfo = getDeviceInfo();
      const response = await api.post('/auth/login', {
        email: identifier.trim(),
        password,
        targetRole: 'SUPER_ADMIN',
        ...deviceInfo,
      });

      if (response.user.role !== 'SUPER_ADMIN') {
        throw new Error('Akun tidak memiliki hak akses Super Admin.');
      }

      login(response.user, response.token, response.stores || []);

      showToast('Autentikasi Super Admin Berhasil.');

      setTimeout(() => {
        router.push('/superadmin');
      }, 800);
    } catch (err: any) {
      console.error('[Super Admin Login Error]', err);
      const errMsg = err.message || 'Login Super Admin gagal';
      const fullMsg = err.details ? `${errMsg}\n${err.details}` : errMsg;
      setError(fullMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden font-sans">
      {/* Background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 z-50 bg-emerald-600 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in border border-emerald-400/40 backdrop-blur-md">
          <CheckCircle2 className="h-5 w-5 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Card className="w-full max-w-md border-red-950/40 bg-slate-900/80 backdrop-blur-xl shadow-2xl relative z-10">
        <CardHeader className="text-center pb-4 pt-6">
          <div className="flex justify-center mb-3">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-red-600 to-slate-900 text-white font-black text-2xl shadow-lg shadow-red-950/50 border border-red-500/20 flex items-center gap-2">
              <Lock className="h-6 w-6 text-red-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black text-white tracking-tight">
            Portal Super Admin
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-1">
            Area terbatas & terenkripsi khusus Administrator Sistem KasirMu
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-5 p-3.5 bg-red-950/60 border border-red-500/40 text-red-300 rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-inner">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="superadmin-identifier"
              type="text"
              label="Username atau Email Administrator"
              placeholder="admin@kasirmu.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              leftIcon={<User className="h-4 w-4 text-slate-400" />}
              required
              disabled={isLoading}
            />

            <div className="flex flex-col gap-1 text-left">
              <label htmlFor="superadmin-password" className="text-xs font-bold text-slate-300">
                Password Master
              </label>
              <div className="relative">
                <input
                  id="superadmin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan Password Master"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 pl-10 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                />
                <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold py-3 rounded-xl shadow-lg shadow-red-950/40 mt-2 cursor-pointer border border-red-500/30"
            >
              Otentikasi Portal Admin
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1.5">
              <span>🔒 Sesi terotentikasi & terpantau audit log IP</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
