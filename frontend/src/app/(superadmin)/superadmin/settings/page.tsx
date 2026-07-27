'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import Card, { CardContent } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { 
  User, 
  Lock, 
  Shield, 
  Activity, 
  Upload, 
  Trash2, 
  Smartphone, 
  Mail, 
  Laptop, 
  Globe, 
  Settings, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';

interface Session {
  id: string;
  deviceName: string;
  browser: string;
  ipAddress: string;
  isActive: boolean;
  lastActivity: string;
}

interface AuditLog {
  id: string;
  action: string;
  description: string;
  createdAt: string;
}

export default function SuperAdminSettings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'activity'>('profile');
  const [isLoading, setIsLoading] = useState(true);

  // User States
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Password Change States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfPass, setShowConfPass] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Re-auth Modals (for username/email changes)
  const [reAuthOpen, setReAuthOpen] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [reAuthAction, setReAuthAction] = useState<'username' | 'email' | null>(null);
  const [reAuthError, setReAuthError] = useState('');
  const [isVerifyingReAuth, setIsVerifyingReAuth] = useState(false);

  // Pending Values (used in re-auth modal confirmation)
  const [pendingUsername, setPendingUsername] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');

  // Email Verify Links generated locally (shown for easy testing)
  const [devEmailLink, setDevEmailLink] = useState('');

  // Phone OTP Verification States
  const [otpOpen, setOtpOpen] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Cropper States
  const [cropperOpen, setCropperOpen] = useState(false);
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperImageRef = useRef<HTMLImageElement>(null);
  const cropperContainerRef = useRef<HTMLDivElement>(null);

  // General Status Messages
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const fetchProfileData = async () => {
    try {
      const res = await api.get('/super-admin/profile');
      const u = res.user;
      setUserId(u.id);
      setName(u.fullName || u.name);
      setUsername(u.username || '');
      setEmail(u.email);
      setPhone(u.phone || '');
      setProfileImage(u.profileImage || null);
      setTwoFactorEnabled(u.twoFactorEnabled);
      setSessions(res.sessions || []);
      setAuditLogs(res.auditLogs || []);
    } catch (err) {
      console.error('Failed to load profile settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  // Password validation checks
  const getPasswordStrength = () => {
    const checks = {
      length: newPassword.length >= 12,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
    };
    const score = Object.values(checks).filter(Boolean).length;
    return { checks, score };
  };

  // Base64 File Uploader trigger
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran berkas melebihi batas maksimal 2 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImageSrc(reader.result as string);
      setCropZoom(1);
      setImagePos({ x: 0, y: 0 });
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    // reset selection so same file triggers change again
    e.target.value = '';
  };

  // Canvas-based Cropper
  const handleCropSave = async () => {
    if (!uploadedImageSrc) return;

    const img = new Image();
    img.src = uploadedImageSrc;
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw cropped image onto 200x200 canvas
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 200, 200);

      // Clip canvas into a circle
      ctx.beginPath();
      ctx.arc(100, 100, 100, 0, Math.PI * 2);
      ctx.clip();

      // Math calculations for image placement based on crop area zoom & dragging
      const containerWidth = 260; // dimension of preview circle
      const containerHeight = 260;

      const scale = cropZoom;
      let drawWidth = containerWidth * scale;
      let drawHeight = containerHeight * scale;

      // Fit center placement calculations
      const destX = (100 - (drawWidth / 2) + (imagePos.x * 200 / containerWidth));
      const destY = (100 - (drawHeight / 2) + (imagePos.y * 200 / containerHeight));

      ctx.drawImage(img, destX, destY, drawWidth, drawHeight);

      const base64Image = canvas.toDataURL('image/jpeg', 0.9);

      try {
        const res = await api.post('/super-admin/upload-avatar', { image: base64Image });
        setProfileImage(res.profileImage);
        setCropperOpen(false);
        setProfileSuccess('Foto profil berhasil diunggah!');
        setTimeout(() => setProfileSuccess(''), 3000);
        fetchProfileData();
      } catch (err: any) {
        alert(err.message || 'Gagal mengunggah foto profil');
      }
    };
  };

  const handleAvatarDelete = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus foto profil Anda?')) return;
    try {
      await api.delete('/super-admin/avatar');
      setProfileImage(null);
      setProfileSuccess('Foto profil berhasil dihapus');
      setTimeout(() => setProfileSuccess(''), 3000);
      fetchProfileData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus foto profil');
    }
  };

  // Profile save form submit handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccess('');
    setProfileError('');
    try {
      await api.patch('/super-admin/profile', { name, fullName: name });
      setProfileSuccess('Informasi profil dasar berhasil diperbarui!');
      setTimeout(() => setProfileSuccess(''), 3000);
      fetchProfileData();
    } catch (err: any) {
      setProfileError(err.message || 'Gagal memperbarui profil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Re-auth password validations before updating username/email
  const triggerReAuth = (action: 'username' | 'email') => {
    setReAuthAction(action);
    setReAuthPassword('');
    setReAuthError('');
    setReAuthOpen(true);
  };

  const handleConfirmReAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reAuthPassword) {
      setReAuthError('Password saat ini wajib diisi');
      return;
    }
    setIsVerifyingReAuth(true);
    setReAuthError('');
    try {
      if (reAuthAction === 'username') {
        await api.patch('/super-admin/change-username', {
          username: pendingUsername,
          password: reAuthPassword
        });
        setProfileSuccess('Username berhasil diubah!');
        setTimeout(() => setProfileSuccess(''), 3000);
        setReAuthOpen(false);
        fetchProfileData();
      } else if (reAuthAction === 'email') {
        const res = await api.patch('/super-admin/change-email', {
          email: pendingEmail,
          password: reAuthPassword
        });
        setProfileSuccess('Permintaan perubahan email berhasil! Silakan periksa inbox verifikasi.');
        if (res.link) {
          setDevEmailLink(res.link); // show dev testing link in debug banner
        }
        setTimeout(() => setProfileSuccess(''), 5000);
        setReAuthOpen(false);
        fetchProfileData();
      }
    } catch (err: any) {
      setReAuthError(err.message || 'Verifikasi gagal.');
    } finally {
      setIsVerifyingReAuth(false);
    }
  };

  // Username change trigger
  const handleSaveUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    const usernameRegex = /^[a-zA-Z0-9_\.]+$/;
    if (username.length < 5 || username.length > 30 || !usernameRegex.test(username)) {
      setProfileError('Username harus 5-30 karakter dan hanya berisi huruf, angka, (_) atau (.)');
      return;
    }
    setPendingUsername(username);
    triggerReAuth('username');
  };

  // Email change trigger
  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setPendingEmail(email);
    triggerReAuth('email');
  };

  // Phone number verify trigger
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    setIsSavingProfile(true);
    setProfileSuccess('');
    setProfileError('');
    try {
      await api.patch('/super-admin/change-phone', { phone });
      setPendingPhone(phone);
      setOtpCode('');
      setOtpError('');
      setOtpOpen(true);
    } catch (err: any) {
      setProfileError(err.message || 'Gagal mengubah nomor telepon');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      setOtpError('Kode OTP harus diisi');
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError('');
    try {
      await api.post('/super-admin/verify-phone', {
        phone: pendingPhone,
        otpCode
      });
      setOtpOpen(false);
      setProfileSuccess('Nomor telepon berhasil diperbarui & diverifikasi!');
      setTimeout(() => setProfileSuccess(''), 3000);
      fetchProfileData();
    } catch (err: any) {
      setOtpError(err.message || 'Kode OTP salah atau kedaluwarsa.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Password updating submit
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password tidak cocok');
      return;
    }

    const { score } = getPasswordStrength();
    if (score < 5) {
      setPasswordError('Password baru belum memenuhi semua kriteria keamanan.');
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await api.patch('/super-admin/change-password', {
        oldPassword,
        newPassword,
        confirmPassword
      });
      setPasswordSuccess(res.message);
      // Wait for success alert then redirect
      setTimeout(() => {
        window.location.href = '/login';
      }, 2500);
    } catch (err: any) {
      setPasswordError(err.message || 'Gagal mengubah password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  // 2FA status toggler
  const handleToggle2FA = async (enable: boolean) => {
    try {
      const res = await api.post('/super-admin/toggle-2fa', { enable });
      setTwoFactorEnabled(res.twoFactorEnabled);
      setProfileSuccess(`Two-Factor Authentication berhasil ${enable ? 'diaktifkan' : 'dinonaktifkan'}!`);
      setTimeout(() => setProfileSuccess(''), 3000);
      fetchProfileData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status 2FA');
    }
  };

  // Logout all devices
  const handleLogoutAllDevices = async () => {
    if (!confirm('Apakah Anda yakin ingin mengeluarkan akun Anda dari semua sesi perangkat lain?')) return;
    try {
      await api.post('/super-admin/logout-all-devices', {});
      alert('Sesi di semua perangkat lain berhasil dihentikan!');
      fetchProfileData();
    } catch (err: any) {
      alert(err.message || 'Gagal memutuskan sesi');
    }
  };

  // Dragging event handlers for crop image movement
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePos.x, y: e.clientY - imagePos.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setImagePos({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const { score: passScore, checks: passChecks } = getPasswordStrength();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-bold text-slate-400">Memuat Detail Akun...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 animate-fadeIn pb-12">
      
      {/* Dev Verification Link Alert Banner */}
      {devEmailLink && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-blue-400 font-semibold">
            <AlertCircle className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <span className="block font-bold">Local Dev Email Verification Sim:</span>
              <span className="block font-mono text-[10px] bg-slate-950/50 p-1.5 rounded mt-1 select-all">{devEmailLink}</span>
            </div>
          </div>
          <a href={devEmailLink} className="px-3 py-1.5 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors">
            Verifikasi Sekarang
          </a>
        </div>
      )}

      {/* Main Settings Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-900 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-800 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
            Pengaturan Akun
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1 uppercase tracking-wider">
            Super Admin Profile & Keamanan Utama
          </p>
        </div>

        {/* Custom Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-900 gap-1 self-stretch sm:self-auto">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-none ${
              activeTab === 'profile' 
                ? 'bg-white dark:bg-slate-850 text-blue-500 shadow-sm shadow-slate-950/10' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="h-4 w-4" />
            Profil
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-none ${
              activeTab === 'security' 
                ? 'bg-white dark:bg-slate-850 text-blue-500 shadow-sm shadow-slate-950/10' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Lock className="h-4 w-4" />
            Keamanan
          </button>
          <button 
            onClick={() => setActiveTab('activity')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-none ${
              activeTab === 'activity' 
                ? 'bg-white dark:bg-slate-850 text-blue-500 shadow-sm shadow-slate-950/10' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="h-4 w-4" />
            Aktivitas
          </button>
        </div>
      </div>

      {profileSuccess && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold animate-fadeIn">{profileSuccess}</div>}
      {profileError && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold animate-fadeIn">{profileError}</div>}

      {/* Tab Contents: Profile */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Avatar Panel */}
          <Card className="md:col-span-1 border border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-900/10 backdrop-blur-md">
            <CardContent className="flex flex-col items-center justify-center p-8 gap-5 text-center">
              <div className="relative group cursor-pointer w-32 h-32 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-center bg-slate-100 dark:bg-slate-950">
                {profileImage ? (
                  <img src={profileImage} alt="Avatar Admin" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-16 w-16 text-slate-400" />
                )}
                
                {/* Upload Trigger Input */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/png, image/jpeg, image/webp" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-black text-slate-850 dark:text-slate-200">{name}</span>
                <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Super Admin</span>
              </div>

              <div className="flex items-center gap-2 w-full">
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline" 
                  className="flex-1 flex justify-center items-center gap-1.5 text-[11px] font-bold"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Unggah Foto
                </Button>
                {profileImage && (
                  <Button 
                    onClick={handleAvatarDelete}
                    variant="outline" 
                    className="p-2 border-red-500/20 hover:bg-red-500/10 hover:border-red-500 text-red-500 rounded-xl"
                    title="Hapus Foto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <span className="text-[10px] text-slate-500 font-semibold leading-tight">
                Mendukung JPG, PNG, atau WEBP. Maks 2 MB.
              </span>
            </CardContent>
          </Card>

          {/* Details Forms */}
          <div className="md:col-span-2 flex flex-col gap-6">
            
            {/* Basic Info */}
            <Card className="border border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-900/10 backdrop-blur-md">
              <CardContent className="p-6 flex flex-col gap-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  Informasi Dasar
                </h3>
                <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
                  <Input 
                    id="admin-full-name" 
                    label="Nama Lengkap *" 
                    placeholder="Masukkan nama lengkap Anda" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                  />
                  <Button 
                    type="submit" 
                    variant="primary" 
                    className="self-end px-6 font-bold" 
                    isLoading={isSavingProfile}
                  >
                    Simpan Perubahan
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Username & Account ID */}
            <Card className="border border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-900/10 backdrop-blur-md">
              <CardContent className="p-6 flex flex-col gap-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-amber-500" />
                  Ganti Username Akun
                </h3>
                <form onSubmit={handleSaveUsername} className="flex flex-col md:flex-row items-end gap-4">
                  <div className="flex-1 w-full">
                    <Input 
                      id="admin-username-input" 
                      label="Username Utama *" 
                      placeholder="e.g. admin.kasirmu" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)} 
                      required 
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    className="px-6 font-bold" 
                    isLoading={isSavingProfile}
                  >
                    Ubah Username
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Secure Email */}
            <Card className="border border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-900/10 backdrop-blur-md">
              <CardContent className="p-6 flex flex-col gap-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-emerald-500" />
                  Ubah Email Utama
                </h3>
                <form onSubmit={handleSaveEmail} className="flex flex-col md:flex-row items-end gap-4">
                  <div className="flex-1 w-full">
                    <Input 
                      id="admin-email-input" 
                      label="Email Login / ID *" 
                      placeholder="e.g. admin@kasirmu.com" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    className="px-6 font-bold" 
                    isLoading={isSavingProfile}
                  >
                    Ubah Email
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Phone OTP */}
            <Card className="border border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-900/10 backdrop-blur-md">
              <CardContent className="p-6 flex flex-col gap-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-purple-500" />
                  Ubah Nomor Telepon
                </h3>
                <form onSubmit={handleSavePhone} className="flex flex-col md:flex-row items-end gap-4">
                  <div className="flex-1 w-full">
                    <Input 
                      id="admin-phone-input" 
                      label="Nomor Telepon *" 
                      placeholder="e.g. 08123456789" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                      required 
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    className="px-6 font-bold" 
                    isLoading={isSavingProfile}
                  >
                    Minta OTP
                  </Button>
                </form>
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* Tab Contents: Security */}
      {activeTab === 'security' && (
        <div className="flex flex-col gap-6 animate-fadeIn">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Change Password Form */}
            <Card className="md:col-span-2 border border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-900/10 backdrop-blur-md">
              <CardContent className="p-6 flex flex-col gap-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-blue-500" />
                  Ganti Kata Sandi
                </h3>

                {passwordSuccess && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold">{passwordSuccess}</div>}
                {passwordError && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold">{passwordError}</div>}

                <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                  
                  {/* Old Password */}
                  <div className="relative">
                    <Input 
                      id="pass-old" 
                      label="Kata Sandi Lama *" 
                      type={showOldPass ? 'text' : 'password'} 
                      placeholder="••••••••" 
                      value={oldPassword} 
                      onChange={(e) => setOldPassword(e.target.value)} 
                      required 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowOldPass(!showOldPass)}
                      className="absolute right-3.5 bottom-2.5 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showOldPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* New Password */}
                  <div className="relative">
                    <Input 
                      id="pass-new" 
                      label="Kata Sandi Baru *" 
                      type={showNewPass ? 'text' : 'password'} 
                      placeholder="••••••••" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      required 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3.5 bottom-2.5 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Confirm Password */}
                  <div className="relative">
                    <Input 
                      id="pass-confirm" 
                      label="Konfirmasi Kata Sandi Baru *" 
                      type={showConfPass ? 'text' : 'password'} 
                      placeholder="••••••••" 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      required 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowConfPass(!showConfPass)}
                      className="absolute right-3.5 bottom-2.5 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showConfPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div className="p-4 bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-900 rounded-xl flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-450 uppercase">Kekuatan Password</span>
                        <span className={`text-[10px] font-black ${
                          passScore === 5 ? 'text-emerald-500' : passScore >= 3 ? 'text-amber-500' : 'text-red-500'
                        }`}>
                          {passScore === 5 ? 'Sangat Kuat' : passScore >= 3 ? 'Sedang' : 'Lemah'}
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="h-1.5 w-full bg-slate-250 dark:bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((idx) => (
                          <div 
                            key={idx}
                            className={`h-full flex-1 transition-all ${
                              idx <= passScore 
                                ? passScore === 5 ? 'bg-emerald-500' : passScore >= 3 ? 'bg-amber-500' : 'bg-red-500'
                                : 'bg-transparent'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Criteria Bullets */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${passChecks.length ? 'text-emerald-500' : 'text-slate-500'}`} />
                          <span className={passChecks.length ? 'text-slate-350' : 'text-slate-500'}>Min. 12 Karakter</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${passChecks.upper ? 'text-emerald-500' : 'text-slate-500'}`} />
                          <span className={passChecks.upper ? 'text-slate-350' : 'text-slate-500'}>1 Huruf Besar</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${passChecks.lower ? 'text-emerald-500' : 'text-slate-500'}`} />
                          <span className={passChecks.lower ? 'text-slate-350' : 'text-slate-500'}>1 Huruf Kecil</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${passChecks.number ? 'text-emerald-500' : 'text-slate-500'}`} />
                          <span className={passChecks.number ? 'text-slate-350' : 'text-slate-500'}>1 Angka</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${passChecks.special ? 'text-emerald-500' : 'text-slate-500'}`} />
                          <span className={passChecks.special ? 'text-slate-350' : 'text-slate-500'}>1 Karakter Spesial</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    variant="primary" 
                    className="w-full font-bold flex justify-center items-center mt-2" 
                    isLoading={isChangingPass}
                    disabled={passScore < 5}
                  >
                    Perbarui Password
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* 2FA Card */}
            <Card className="md:col-span-1 border border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-900/10 backdrop-blur-md">
              <CardContent className="p-6 flex flex-col gap-5 justify-between h-full">
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    Two-Factor Auth (2FA)
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-semibold">
                    Amankan login Super Admin Anda dengan verifikasi 2 langkah untuk mencegah akses ilegal.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl">
                  <span className="text-[11px] font-bold text-slate-350 uppercase">Aktifkan 2FA</span>
                  
                  {/* Switch */}
                  <button 
                    onClick={() => handleToggle2FA(!twoFactorEnabled)}
                    className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${
                      twoFactorEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                  >
                    <div 
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                        twoFactorEnabled ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Active Sessions Panel */}
          <Card className="border border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-900/10 backdrop-blur-md">
            <CardContent className="p-6 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-blue-500" />
                  Sesi Login Perangkat
                </h3>
                <Button 
                  onClick={handleLogoutAllDevices}
                  variant="outline" 
                  className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl cursor-pointer"
                >
                  Logout Semua Perangkat
                </Button>
              </div>

              {/* Session Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-900 rounded-2xl">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-400 uppercase font-black tracking-wider text-[9px] border-b border-slate-200 dark:border-slate-900">
                    <tr>
                      <th className="px-6 py-3.5">Perangkat</th>
                      <th className="px-6 py-3.5">Browser</th>
                      <th className="px-6 py-3.5">IP Address</th>
                      <th className="px-6 py-3.5">Waktu Aktivitas</th>
                      <th className="px-6 py-3.5">Sesi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-900 bg-white/10">
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-semibold italic">
                          Tidak ada sesi aktif terdeteksi
                        </td>
                      </tr>
                    ) : (
                      sessions.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-100/5 transition-colors font-bold">
                          <td className="px-6 py-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <Laptop className="h-4 w-4 text-slate-400" />
                            {s.deviceName}
                          </td>
                          <td className="px-6 py-4 text-slate-400">
                            <Globe className="h-3.5 w-3.5 inline mr-1 text-slate-500" />
                            {s.browser}
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{s.ipAddress}</td>
                          <td className="px-6 py-4 text-slate-400 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                            {new Date(s.lastActivity).toLocaleTimeString('id-ID')} ({new Date(s.lastActivity).toLocaleDateString('id-ID')})
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                              🟢 Aktif
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </CardContent>
          </Card>

        </div>
      )}

      {/* Tab Contents: Activity Log */}
      {activeTab === 'activity' && (
        <Card className="border border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-900/10 backdrop-blur-md animate-fadeIn">
          <CardContent className="p-6 flex flex-col gap-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Riwayat Aktivitas Akun
            </h3>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-900 rounded-2xl">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-400 uppercase font-black tracking-wider text-[9px] border-b border-slate-200 dark:border-slate-900">
                  <tr>
                    <th className="px-6 py-3.5">Tanggal & Waktu</th>
                    <th className="px-6 py-3.5">Aksi / Event</th>
                    <th className="px-6 py-3.5">Keterangan Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-900 bg-white/10">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-slate-500 font-semibold italic">
                        Belum ada riwayat aktivitas tercatat
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-100/5 transition-colors font-bold">
                        <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('id-ID')}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-250 dark:bg-slate-800 text-slate-800 dark:text-slate-350">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {log.description}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog Re-Authentication */}
      <Dialog isOpen={reAuthOpen} onClose={() => setReAuthOpen(false)} title="Konfirmasi Keamanan" description="Demi keamanan data Anda, silakan masukkan password saat ini untuk memverifikasi perubahan sensitif ini.">
        <form onSubmit={handleConfirmReAuth} className="flex flex-col gap-4">
          {reAuthError && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold">{reAuthError}</div>}
          
          <Input 
            id="reauth-pass-input" 
            label="Password Saat Ini *" 
            type="password" 
            placeholder="••••••••" 
            value={reAuthPassword} 
            onChange={(e) => setReAuthPassword(e.target.value)} 
            required 
          />

          <Button type="submit" variant="primary" className="w-full font-bold flex justify-center items-center mt-2" isLoading={isVerifyingReAuth}>
            Verifikasi & Simpan
          </Button>
        </form>
      </Dialog>

      {/* Dialog OTP Phone Verify */}
      <Dialog isOpen={otpOpen} onClose={() => setOtpOpen(false)} title="Verifikasi Nomor Telepon Baru" description="Masukkan kode 6 digit OTP yang telah dikirimkan ke nomor telepon baru Anda.">
        <form onSubmit={handleVerifyPhoneOtp} className="flex flex-col gap-4">
          {otpError && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold">{otpError}</div>}
          
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-[10px] font-bold leading-relaxed">
            [SIMULASI LOCAL DEV] Kode OTP telah ditulis ke file log backend Anda: <b>backend/logs/otp.log</b>
          </div>

          <Input 
            id="otp-code-input" 
            label="Masukkan 6 Digit OTP *" 
            placeholder="••••••" 
            maxLength={6}
            value={otpCode} 
            onChange={(e) => setOtpCode(e.target.value)} 
            required 
          />

          <Button type="submit" variant="primary" className="w-full font-bold flex justify-center items-center mt-2" isLoading={isVerifyingOtp}>
            Verifikasi OTP
          </Button>
        </form>
      </Dialog>

      {/* Dialog Image Cropper (Interactive drag-and-zoom) */}
      <Dialog isOpen={cropperOpen} onClose={() => setCropperOpen(false)} title="Sesuaikan & Potong Foto Profil" description="Geser gambar atau gunakan slider untuk menyesuaikan ukuran foto profil Anda.">
        <div className="flex flex-col items-center gap-6 py-4">
          
          {/* Circular mask window container */}
          <div 
            ref={cropperContainerRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-[260px] h-[260px] rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950/80 relative flex items-center justify-center cursor-move"
          >
            {uploadedImageSrc && (
              <img 
                ref={cropperImageRef}
                src={uploadedImageSrc} 
                alt="Image to crop" 
                onMouseDown={handleMouseDown}
                style={{
                  transform: `scale(${cropZoom}) translate(${imagePos.x}px, ${imagePos.y}px)`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  pointerEvents: 'auto',
                }}
                className="select-none"
              />
            )}
            
            {/* Viewport circular guidance ring */}
            <div className="absolute inset-0 rounded-full border border-dashed border-blue-500/40 pointer-events-none" />
          </div>

          {/* Zoom Slider */}
          <div className="w-full flex flex-col gap-2">
            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wide">
              <span>Zoom Gambar</span>
              <span>{Math.round(cropZoom * 100)}%</span>
            </div>
            <input 
              type="range" 
              min={1} 
              max={3} 
              step={0.05} 
              value={cropZoom}
              onChange={(e) => setCropZoom(parseFloat(e.target.value))}
              className="w-full accent-blue-500 bg-slate-800 rounded-lg appearance-none h-1.5 cursor-pointer"
            />
          </div>

          <div className="flex gap-2 w-full">
            <Button onClick={() => setCropperOpen(false)} variant="outline" className="flex-1 font-bold">
              Batal
            </Button>
            <Button onClick={handleCropSave} variant="primary" className="flex-1 font-bold">
              Simpan & Potong
            </Button>
          </div>

        </div>
      </Dialog>

    </div>
  );
}
