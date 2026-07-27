'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { 
  User, 
  Lock, 
  KeyRound, 
  Mail, 
  Phone, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Link as LinkIcon, 
  Unlink, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export default function ProfileSettingsPage() {
  const { user, updateUser } = useAuthStore();

  // Feedback Messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingSection, setLoadingSection] = useState<string | null>(null);

  // Username State
  const [username, setUsername] = useState('');
  
  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email & Phone State
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);

  // Forgot Password Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotOtpCode, setForgotOtpCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'SEND' | 'VERIFY'>('SEND');

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const clearAlerts = () => {
    setSuccessMsg('');
    setErrorMsg('');
  };

  // 1. Ubah Username
  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    if (!username || username.length < 6 || username.length > 30) {
      setErrorMsg('Username harus 6 - 30 karakter.');
      return;
    }
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      setErrorMsg('Username hanya boleh huruf, angka, underscore (_), dan titik (.).');
      return;
    }

    setLoadingSection('username');
    try {
      const res = await api.post('/auth/profile/update-username', { username });
      updateUser({ username: res.username });
      setSuccessMsg('Username berhasil diperbarui!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui username.');
    } finally {
      setLoadingSection(null);
    }
  };

  // 2. Ubah / Ganti Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    if (user?.hasPassword && !currentPassword) {
      setErrorMsg('Password saat ini wajib diisi.');
      return;
    }
    if (!newPassword || !confirmPassword) {
      setErrorMsg('Password baru dan konfirmasi password wajib diisi.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.');
      return;
    }

    setLoadingSection('password');
    try {
      await api.post('/auth/profile/update-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      updateUser({ hasPassword: true });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg('Password berhasil diperbarui!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui password.');
    } finally {
      setLoadingSection(null);
    }
  };

  // 3. Hubungkan Google Account
  const handleLinkGoogle = async () => {
    clearAlerts();
    setLoadingSection('google');
    try {
      const mockToken = `mock_owner_${Date.now()}`;
      const res = await api.post('/auth/profile/link-google', { token: mockToken });
      updateUser({ isGoogleVerified: true });
      setSuccessMsg(res.message || 'Akun Google berhasil dihubungkan!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghubungkan akun Google.');
    } finally {
      setLoadingSection(null);
    }
  };

  // 4. Putuskan Akun Google
  const handleUnlinkGoogle = async () => {
    clearAlerts();
    if (!user?.hasPassword) {
      setErrorMsg('Anda harus membuat password terlebih dahulu sebelum memutuskan akun Google.');
      return;
    }

    setLoadingSection('google');
    try {
      await api.post('/auth/profile/unlink-google', {});
      updateUser({ isGoogleVerified: false });
      setSuccessMsg('Akun Google berhasil diputuskan!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memutuskan akun Google.');
    } finally {
      setLoadingSection(null);
    }
  };

  // 5. Ubah Email
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    if (!email) {
      setErrorMsg('Alamat email wajib diisi.');
      return;
    }

    setLoadingSection('email');
    try {
      const res = await api.post('/auth/profile/update-email', {
        newEmail: email,
        password: emailPassword,
      });
      updateUser({ email: res.email });
      setEmailPassword('');
      setSuccessMsg('Email berhasil diperbarui!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui email.');
    } finally {
      setLoadingSection(null);
    }
  };

  // 6. Ubah No HP & OTP
  const handleSendPhoneOTP = async () => {
    clearAlerts();
    if (!phone) {
      setErrorMsg('Nomor telepon wajib diisi.');
      return;
    }

    setLoadingSection('phone');
    try {
      await api.post('/auth/otp/send', { phone });
      setIsOtpSent(true);
      setSuccessMsg('Kode OTP berhasil dikirim ke nomor HP Anda!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim OTP.');
    } finally {
      setLoadingSection(null);
    }
  };

  const handleVerifyPhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (!otpCode || otpCode.length !== 6) {
      setErrorMsg('Kode OTP harus 6 digit.');
      return;
    }

    setLoadingSection('phone');
    try {
      await api.post('/auth/otp/verify', { code: otpCode });
      updateUser({ phone, phoneVerified: true });
      setIsOtpSent(false);
      setOtpCode('');
      setSuccessMsg('Nomor HP berhasil diperbarui dan diverifikasi!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Kode OTP salah.');
    } finally {
      setLoadingSection(null);
    }
  };

  // 7. Lupa Password OTP Email Flow
  const handleSendForgotEmailOTP = async () => {
    clearAlerts();
    setLoadingSection('forgot');
    try {
      await api.post('/auth/forgot-password/send-otp', { email: user?.email });
      setForgotStep('VERIFY');
      setSuccessMsg(`Kode OTP reset password telah dikirim ke email ${user?.email}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim OTP reset password.');
    } finally {
      setLoadingSection(null);
    }
  };

  const handleResetPasswordWithOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (!forgotOtpCode || !forgotNewPassword) {
      setErrorMsg('Kode OTP dan Password Baru wajib diisi.');
      return;
    }

    setLoadingSection('forgot');
    try {
      await api.post('/auth/forgot-password/reset-password', {
        email: user?.email,
        otpCode: forgotOtpCode,
        newPassword: forgotNewPassword,
      });
      updateUser({ hasPassword: true });
      setIsForgotModalOpen(false);
      setForgotStep('SEND');
      setForgotOtpCode('');
      setForgotNewPassword('');
      setSuccessMsg('Password berhasil direset via Email OTP!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mereset password.');
    } finally {
      setLoadingSection(null);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto flex flex-col gap-6">
      
      {/* Header Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <ShieldCheck className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          Pengaturan Profil & Keamanan Akun
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm mt-1">
          Kelola kredensial login, integrasi Google OAuth, ubah email/nomor HP, dan keamanan akun Anda.
        </p>
      </div>

      {/* Global Alerts */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-sm animate-shake">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-sm">
          <Check className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ----------------- CARD 1: UBAH USERNAME ----------------- */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                <User className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Ubah Username</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
                  Username dapat digunakan untuk login ke platform KasirMu.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleUpdateUsername} className="flex flex-col gap-4">
              <Input
                id="usernameInput"
                type="text"
                label="Username Saat Ini / Baru"
                placeholder="contoh_owner"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                leftIcon={<User className="h-4 w-4" />}
                required
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Ketentuan: Minimal 6 karakter, maksimal 30 karakter. Hanya huruf, angka, underscore (_), dan titik (.).
              </span>

              <Button
                type="submit"
                variant="primary"
                className="bg-blue-600! hover:bg-blue-700! text-white font-bold cursor-pointer self-start"
                isLoading={loadingSection === 'username'}
              >
                Simpan Username
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ----------------- CARD 2: INTEGRASI GOOGLE OAUTH ----------------- */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                <LinkIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Integrasi Akun Google</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
                  Hubungkan akun Google untuk login cepat 1-Klik.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 flex flex-col gap-5">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center font-bold text-xs">
                  G
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Status Google OAuth</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {user?.isGoogleVerified ? 'Terhubung (Active)' : 'Belum Terhubung'}
                  </span>
                </div>
              </div>

              {user?.isGoogleVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                  <Check className="h-3 w-3" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                  Not Linked
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {!user?.isGoogleVerified ? (
                <Button
                  onClick={handleLinkGoogle}
                  variant="outline"
                  className="border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 font-bold cursor-pointer flex items-center gap-2"
                  isLoading={loadingSection === 'google'}
                >
                  <LinkIcon className="h-4 w-4" />
                  Hubungkan Akun Google
                </Button>
              ) : (
                <Button
                  onClick={handleUnlinkGoogle}
                  variant="outline"
                  className="border-red-300 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold cursor-pointer flex items-center gap-2"
                  isLoading={loadingSection === 'google'}
                >
                  <Unlink className="h-4 w-4" />
                  Putuskan Akun Google
                </Button>
              )}
            </div>
            {!user?.hasPassword && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                * Catatan: Anda wajib membuat Password Login terlebih dahulu sebelum memutuskan akun Google.
              </span>
            )}
          </CardContent>
        </Card>

        {/* ----------------- CARD 3: UBAH / GANTI PASSWORD ----------------- */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm md:col-span-2">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                    {user?.hasPassword ? 'Ganti Password Akun' : 'Buat Password Akun'}
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
                    Perbarui password akun Anda secara berkala untuk menjaga keamanan data toko.
                  </CardDescription>
                </div>
              </div>

              <Button
                onClick={() => setIsForgotModalOpen(true)}
                variant="outline"
                className="text-xs border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 font-bold cursor-pointer"
              >
                Lupa Password? (Email OTP)
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleUpdatePassword} className="grid md:grid-cols-3 gap-4">
              
              {user?.hasPassword && (
                <div className="flex flex-col gap-1.5 md:col-span-3">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password Saat Ini</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="Masukkan Password Saat Ini"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full h-10 px-3 pl-10 pr-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                    <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password Baru</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Password Baru"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-10 px-3 pl-10 pr-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Konfirmasi Password Baru</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Konfirmasi Password Baru"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-10 px-3 pl-10 pr-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full bg-blue-600! hover:bg-blue-700! text-white font-bold cursor-pointer"
                  isLoading={loadingSection === 'password'}
                >
                  Simpan Password
                </Button>
              </div>

              {/* Password Rules checklist */}
              <div className="md:col-span-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">Aturan Password:</span>
                <span className={newPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>✓ Min 8 Karakter</span>
                <span className={/[A-Z]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>✓ Minimal 1 Huruf Besar</span>
                <span className={/[a-z]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>✓ Minimal 1 Huruf Kecil</span>
                <span className={/[0-9]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>✓ Minimal 1 Angka</span>
                <span className={/[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>✓ Minimal 1 Simbol</span>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ----------------- CARD 4: UBAH EMAIL ----------------- */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Ubah Email Akun</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
                  Email digunakan untuk penerimaan tagihan, notifikasi, dan reset password.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleUpdateEmail} className="flex flex-col gap-4">
              <Input
                id="emailInput"
                type="email"
                label="Alamat Email"
                placeholder="owner@kasirmu.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                required
              />

              {user?.hasPassword && (
                <Input
                  id="emailPasswordConfirm"
                  type="password"
                  label="Konfirmasi Password untuk Mengubah Email"
                  placeholder="Masukkan Password Saat Ini"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  leftIcon={<Lock className="h-4 w-4" />}
                  required
                />
              )}

              <Button
                type="submit"
                variant="primary"
                className="bg-blue-600! hover:bg-blue-700! text-white font-bold cursor-pointer self-start"
                isLoading={loadingSection === 'email'}
              >
                Simpan Email
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ----------------- CARD 5: UBAH NOMOR HP ----------------- */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Ubah Nomor Telepon (OTP)</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
                  Nomor HP WhatsApp/SMS aktif untuk keamanan akun & verifikasi transaksi.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 flex flex-col gap-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  id="phoneInput"
                  type="text"
                  label="Nomor Telepon / WhatsApp"
                  placeholder="08123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone className="h-4 w-4" />}
                  required
                />
              </div>
              <Button
                type="button"
                onClick={handleSendPhoneOTP}
                variant="outline"
                className="border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 font-bold h-10 shrink-0 cursor-pointer"
                isLoading={loadingSection === 'phone'}
              >
                Kirim OTP
              </Button>
            </div>

            {isOtpSent && (
              <form onSubmit={handleVerifyPhoneOTP} className="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                <Input
                  id="phoneOtpCode"
                  type="text"
                  label="Masukkan 6 Digit OTP"
                  placeholder="••••••"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={6}
                  leftIcon={<KeyRound className="h-4 w-4" />}
                  className="text-center font-black tracking-widest text-base"
                  required
                />
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-blue-600! hover:bg-blue-700! text-white font-bold cursor-pointer"
                  isLoading={loadingSection === 'phone'}
                >
                  Verifikasi & Simpan No HP
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ----------------- FORGOT PASSWORD MODAL ----------------- */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5 animate-zoom-in">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Reset Password via Email OTP
              </h3>
              <button
                onClick={() => setIsForgotModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {forgotStep === 'SEND' ? (
              <div className="flex flex-col gap-4 text-xs text-slate-600 dark:text-slate-300">
                <p>
                  Klik tombol di bawah ini untuk mengirimkan kode OTP 6-digit ke email akun Anda (<strong className="text-slate-900 dark:text-white">{user?.email}</strong>).
                </p>
                <Button
                  onClick={handleSendForgotEmailOTP}
                  variant="primary"
                  className="w-full bg-blue-600! hover:bg-blue-700! text-white font-bold py-3 cursor-pointer"
                  isLoading={loadingSection === 'forgot'}
                >
                  Kirim Kode OTP Reset Password
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPasswordWithOTP} className="flex flex-col gap-4">
                <Input
                  id="forgotOtp"
                  type="text"
                  label="Kode OTP 6 Digit"
                  placeholder="••••••"
                  value={forgotOtpCode}
                  onChange={(e) => setForgotOtpCode(e.target.value)}
                  maxLength={6}
                  className="text-center font-black tracking-widest text-lg"
                  required
                />
                <Input
                  id="forgotPassword"
                  type="password"
                  label="Password Baru"
                  placeholder="Masukkan Password Baru"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full bg-blue-600! hover:bg-blue-700! text-white font-bold py-3 cursor-pointer"
                  isLoading={loadingSection === 'forgot'}
                >
                  Reset & Simpan Password Baru
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
