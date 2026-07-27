'use client';

import React, { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '../../../store/useAuthStore';
import { api } from '../../../lib/api';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import Dialog from '../../../components/ui/Dialog';
import { Lock, Shield, User, Mail, LogIn, Eye, EyeOff, CheckCircle2, AlertCircle, Key } from 'lucide-react';
import { getDeviceInfo } from '../../../lib/device';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');
  const login = useAuthStore((state) => state.login);
  
  const [activeRole, setActiveRole] = useState<'OWNER' | 'CASHIER'>(
    roleParam === 'cashier' ? 'CASHIER' : 'OWNER'
  );

  // Login Manual Modal States for Owner / Multi-role
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showManualPassword, setShowManualPassword] = useState(false);

  // Common Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Forgot Password Modal States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3 | 4>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  // Check remembered user on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('kasirmu_remembered_identifier');
      if (savedUser) {
        setIdentifier(savedUser);
        setRememberMe(true);
      }
    }
  }, []);

  // Load Google Identity Services Script
  useEffect(() => {
    const existing = document.getElementById('google-gsi-client');
    if (existing) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.id = 'google-gsi-client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setScriptLoaded(true);
    };
    document.body.appendChild(script);
  }, []);

  // Initialize and Render Google Sign-in Button
  useEffect(() => {
    if (scriptLoaded && activeRole === 'OWNER') {
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).google) {
          (window as any).google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '1082643534346-placeholder.apps.googleusercontent.com',
            callback: handleGoogleLoginSuccess,
          });

          const container = document.getElementById('google-login-button-container');
          if (container) {
            (window as any).google.accounts.id.renderButton(
              container,
              { theme: 'outline', size: 'large', width: 380, shape: 'rectangular' }
            );
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scriptLoaded, activeRole]);

  // Toast Helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Handle Google Login Success
  const handleGoogleLoginSuccess = async (response: any) => {
    setIsLoading(true);
    setError('');
    try {
      const googleToken = response.credential;
      const res = await api.post('/auth/google', { token: googleToken });
      
      login(res.user, res.token, res.stores || []);

      showToast('Selamat datang kembali.');

      setTimeout(() => {
        if (res.user.status === 'ACTIVE') {
          router.push('/dashboard');
        } else {
          router.push('/pending-approval');
        }
      }, 1000);
    } catch (err: any) {
      console.error('[Google Auth Error]', err);
      setError(err.message || 'Autentikasi akun Google gagal.');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Mock Google Login for local development testing
  const triggerMockGoogleLogin = async (mockToken: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/google', { token: mockToken });
      
      login(response.user, response.token, response.stores || []);

      showToast('Selamat datang kembali.');

      setTimeout(() => {
        if (response.user.status === 'ACTIVE') {
          router.push('/dashboard');
        } else {
          router.push('/pending-approval');
        }
      }, 1000);
    } catch (err: any) {
      console.error('[Mock Google Login Error]', err);
      setError(err.message || 'Simulasi login gagal.');
    } finally {
      setIsLoading(false);
    }
  };

  // Login Manual Handler (Owner / Multi-role)
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setModalError('');

    // Validation
    if (!identifier || !identifier.trim()) {
      setError('Username atau Email wajib diisi.');
      setModalError('Username atau Email wajib diisi.');
      return;
    }

    if (!manualPassword) {
      setError('Password wajib diisi.');
      setModalError('Password wajib diisi.');
      return;
    }

    setIsLoading(true);

    try {
      const deviceInfo = getDeviceInfo();
      const response = await api.post('/auth/login', {
        email: identifier,
        password: manualPassword,
        targetRole: 'OWNER',
        ...deviceInfo,
      });

      // Handle "Ingat Saya"
      if (rememberMe) {
        localStorage.setItem('kasirmu_remembered_identifier', identifier);
      } else {
        localStorage.removeItem('kasirmu_remembered_identifier');
      }

      // Save user session
      login(response.user, response.token, response.stores || []);

      setIsManualModalOpen(false);
      showToast('Selamat datang kembali.');

      // Role-based redirection for Owner
      setTimeout(() => {
        if (response.user.status === 'ACTIVE') {
          router.push('/dashboard');
        } else {
          router.push('/pending-approval');
        }
      }, 1000);
    } catch (err: any) {
      console.error('[Manual Login Error]', err);
      const errMsg = err.message || 'Login gagal';
      const fullMsg = err.details ? `${errMsg}\n${err.details}` : errMsg;
      setError(fullMsg);
      setModalError(fullMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Cashier / Admin Direct Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Username atau Email dan Password wajib diisi');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const deviceInfo = getDeviceInfo();
      const response = await api.post('/auth/login', {
        email,
        password,
        targetRole: 'CASHIER',
        ...deviceInfo,
      });

      // Store session in state and localStorage
      login(response.user, response.token, response.stores || []);

      showToast('Selamat datang kembali.');

      setTimeout(() => {
        router.push('/pos');
      }, 1000);
    } catch (err: any) {
      console.error('[Login Error]', err);
      const errMsg = err.message || 'Username atau Email dan Password salah';
      const fullMsg = err.details ? `${errMsg}\n${err.details}` : errMsg;
      setError(fullMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Forgot Password Handlers ──
  const handleOpenForgotModal = () => {
    setIsManualModalOpen(false);
    setIsForgotModalOpen(true);
    setForgotStep(1);
    setForgotEmail(identifier.includes('@') ? identifier : '');
    setForgotOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
  };

  const handleSendForgotOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotEmail || !forgotEmail.trim()) {
      setForgotError('Email wajib diisi');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotEmail)) {
      setForgotError('Format email tidak valid');
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/send-otp', { email: forgotEmail });
      setForgotSuccess(res.message || 'Kode OTP berhasil dikirim ke email Anda.');
      setForgotStep(2);
    } catch (err: any) {
      setForgotError(err.message || 'Gagal mengirim kode OTP.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleVerifyForgotOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotOtp || forgotOtp.length !== 6) {
      setForgotError('Masukkan 6 digit kode OTP');
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/verify-otp', {
        email: forgotEmail,
        otpCode: forgotOtp,
      });
      setForgotSuccess(res.message || 'Kode OTP berhasil diverifikasi.');
      setForgotStep(3);
    } catch (err: any) {
      setForgotError(err.message || 'Kode OTP tidak valid atau telah kedaluwarsa.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!newPassword || newPassword.length < 8) {
      setForgotError('Password minimal 8 karakter');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError('Konfirmasi password tidak cocok');
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/reset-password', {
        email: forgotEmail,
        otpCode: forgotOtp,
        newPassword,
      });
      setForgotSuccess(res.message || 'Password berhasil diperbarui.');
      setForgotStep(4);
    } catch (err: any) {
      setForgotError(err.message || 'Gagal mengupdate password.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 z-50 bg-emerald-600 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in border border-emerald-400/40 backdrop-blur-md">
          <CheckCircle2 className="h-5 w-5 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Card className="w-full max-w-md border-slate-800 bg-slate-900/60 backdrop-blur-md relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className={`p-2.5 rounded-lg text-white font-black text-xl transition-colors duration-355 ${activeRole === 'OWNER' ? 'bg-blue-600' : activeRole === 'CASHIER' ? 'bg-emerald-600' : 'bg-slate-700'}`}>KM</div>
          </div>
          <CardTitle className="text-xl font-extrabold text-white transition-all duration-355">
            {activeRole === 'OWNER' ? 'Portal Owner / Mitra' : 'Terminal POS Kasir'}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {activeRole === 'OWNER' ? 'Masuk untuk mengelola outlet dan laporan omzet' : 'Masuk untuk memulai shift penjualan kasir'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Role Tab Selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl mb-6 border border-slate-850">
            <button
              type="button"
              onClick={() => {
                setActiveRole('OWNER');
                setError('');
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeRole === 'OWNER'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              Owner / Mitra
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRole('CASHIER');
                setError('');
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeRole === 'CASHIER'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              Kasir / Staff
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeRole === 'OWNER' ? (
            <form onSubmit={handleManualLogin} className="flex flex-col gap-4 animate-fade-in">
              <Input
                id="owner-identifier"
                type="text"
                label="Username atau Email"
                placeholder="Masukkan Username atau Email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                leftIcon={<User className="h-4 w-4 text-slate-400" />}
                required
                disabled={isLoading}
              />

              <div className="flex flex-col gap-1 text-left">
                <label htmlFor="owner-password" className="text-xs font-bold text-slate-300">Password</label>
                <div className="relative">
                  <input
                    id="owner-password"
                    type={showManualPassword ? 'text' : 'password'}
                    placeholder="Masukkan Password"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full px-3 py-2.5 pl-10 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowManualPassword(!showManualPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showManualPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                  />
                  <span>Ingat Saya</span>
                </label>

                <button
                  type="button"
                  onClick={handleOpenForgotModal}
                  className="text-blue-400 hover:text-blue-300 font-semibold hover:underline cursor-pointer"
                >
                  Lupa Password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-3 rounded-xl shadow-lg shadow-blue-900/20 mt-1 cursor-pointer"
              >
                Masuk
              </Button>

              <div className="flex items-center gap-2 my-2 text-[10px] text-slate-500 justify-center font-bold tracking-wider uppercase">
                <span className="h-[1px] flex-1 bg-slate-800" />
                <span>ATAU LOGIN DENGAN GOOGLE</span>
                <span className="h-[1px] flex-1 bg-slate-800" />
              </div>

              {/* 1. Login dengan Google */}
              <div id="google-login-button-container" className="w-full flex justify-center min-h-[46px]" />

              {/* 2. Mock Buttons for Local Dev */}
              {process.env.NODE_ENV === 'development' && (
                <div className="w-full flex flex-col gap-2 mt-2 border-t border-slate-800 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => triggerMockGoogleLogin('mock_owner_' + Math.floor(Math.random() * 1000))}
                    className="w-full text-slate-300 border-slate-800 hover:bg-slate-800 text-xs font-bold py-2 cursor-pointer"
                    disabled={isLoading}
                  >
                    Simulasi Login / Daftar Owner Baru
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => triggerMockGoogleLogin('mock_owner_seeded')}
                    className="w-full text-blue-400 border-blue-950 hover:bg-blue-950/20 text-xs font-bold py-2 cursor-pointer"
                    disabled={isLoading}
                  >
                    Login Owner Demo
                  </Button>
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                id="email"
                type="text"
                label="Username atau Email Kasir"
                placeholder="Masukkan Username atau Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<User className="h-4 w-4" />}
                required
                disabled={isLoading}
              />

              <Input
                id="password"
                type="password"
                label="Password"
                placeholder="Masukkan Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                required
                disabled={isLoading}
              />

              <Button
                type="submit"
                className="w-full mt-2 font-bold tracking-wide transition-all duration-300 border-none bg-emerald-600! hover:bg-emerald-700! text-white shadow-emerald-900/10"
                isLoading={isLoading}
              >
                Buka Terminal Kasir
              </Button>
            </form>
          )}

          {activeRole === 'OWNER' && (
            <div className="mt-6 text-center text-xs text-slate-400">
              Belum memiliki akun?{' '}
              <Link href="/register" className="text-blue-400 hover:text-blue-300 font-semibold hover:underline">
                Daftar dengan Google
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── MODAL 1: Login Manual Popup ── */}
      <Dialog
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Login Manual"
        description="Masukkan Username atau Email dan Password untuk masuk ke akun Anda."
      >
        <form onSubmit={handleManualLogin} className="flex flex-col gap-4">
          {modalError && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <Input
            id="manual-modal-identifier"
            type="text"
            label="Username atau Email"
            placeholder="Masukkan Username atau Email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            leftIcon={<User className="h-4 w-4 text-slate-400" />}
            required
            disabled={isLoading}
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
            <div className="relative">
              <input
                id="manual-modal-password"
                type={showManualPassword ? 'text' : 'password'}
                placeholder="Masukkan Password"
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-3 py-2.5 pl-10 pr-10 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowManualPassword(!showManualPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showManualPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500 h-4 w-4 cursor-pointer"
              />
              <span>Ingat Saya</span>
            </label>

            <button
              type="button"
              onClick={handleOpenForgotModal}
              className="text-blue-400 hover:text-blue-300 font-semibold hover:underline cursor-pointer"
            >
              Lupa Password?
            </button>
          </div>

          <div className="flex gap-3 mt-3 pt-2 border-t border-slate-800/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsManualModalOpen(false)}
              disabled={isLoading}
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
            >
              Login
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ── MODAL 2: Reset Password Flow ── */}
      <Dialog
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Reset Password Akun KasirMu"
        description={
          forgotStep === 1
            ? 'Masukkan Email terdaftar Anda untuk menerima kode OTP reset password.'
            : forgotStep === 2
            ? 'Masukkan 6 digit kode OTP yang telah dikirim ke email Anda.'
            : forgotStep === 3
            ? 'Buat password baru minimal 8 karakter untuk akun Anda.'
            : 'Password Anda telah berhasil diperbarui.'
        }
      >
        {forgotError && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{forgotError}</span>
          </div>
        )}

        {forgotSuccess && forgotStep !== 4 && (
          <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{forgotSuccess}</span>
          </div>
        )}

        {/* STEP 1: Input Email */}
        {forgotStep === 1 && (
          <form onSubmit={handleSendForgotOTP} className="flex flex-col gap-4">
            <Input
              id="forgot-email"
              type="email"
              label="Email Terdaftar"
              placeholder="nama@email.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4 text-slate-400" />}
              required
              disabled={isForgotLoading}
            />

            <div className="flex gap-3 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsForgotModalOpen(false);
                  setIsManualModalOpen(true);
                }}
                disabled={isForgotLoading}
                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isForgotLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
              >
                Kirim Kode OTP
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: Input OTP */}
        {forgotStep === 2 && (
          <form onSubmit={handleVerifyForgotOTP} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-300">Masukkan 6 Digit OTP</label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={forgotOtp}
                onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-[0.5em] text-lg font-mono px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                required
                disabled={isForgotLoading}
              />
            </div>

            {/* Dev Simulator Log Notice */}
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 font-bold text-blue-400 mb-1">
                <Key className="h-3.5 w-3.5" />
                <span>[SIMULASI LOCAL DEV]</span>
              </div>
              <span>Kode OTP tersimpan dalam file log. Cek file: <code className="text-slate-200 font-mono">backend/logs/otp.log</code></span>
            </div>

            <div className="flex gap-3 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotStep(1)}
                disabled={isForgotLoading}
                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Kembali
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isForgotLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
              >
                Verifikasi OTP
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: Input New Password */}
        {forgotStep === 3 && (
          <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-300">Password Baru (min. 8 karakter)</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Masukkan Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isForgotLoading}
                  className="w-full px-3 py-2.5 pl-10 pr-10 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
                <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-300">Konfirmasi Password Baru</label>
              <input
                type="password"
                placeholder="Masukkan Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isForgotLoading}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotStep(2)}
                disabled={isForgotLoading}
                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Kembali
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isForgotLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
              >
                Simpan Password Baru
              </Button>
            </div>
          </form>
        )}

        {/* STEP 4: Success Message */}
        {forgotStep === 4 && (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-white">Password Berhasil Diperbarui!</h4>
              <p className="text-xs text-slate-400 mt-1">
                Silakan masuk kembali menggunakan password baru Anda.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => {
                setIsForgotModalOpen(false);
                setIsManualModalOpen(true);
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer mt-2"
            >
              Login Kembali
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-slate-950 px-4 py-12">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-slate-800" />
          <div className="h-4 w-28 bg-slate-800 rounded" />
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
