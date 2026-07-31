'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { 
  ShieldAlert, 
  Clock, 
  AlertOctagon, 
  LogOut, 
  User, 
  Briefcase, 
  Phone, 
  KeyRound, 
  Check, 
  CheckCircle2,
  Store, 
  Calendar,
  MapPin,
  Lock,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  Home,
  Image as ImageIcon
} from 'lucide-react';

export default function PendingApprovalPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, updateUser } = useAuthStore();
  
  // Wizard state & error message
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sub-step flow after OTP
  const [subStep, setSubStep] = useState<'INITIAL' | 'CREATE_PASSWORD' | 'REGISTRATION_SUCCESS'>('INITIAL');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2 Form States (Profile completion)
  const [fullName, setFullName] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [storeName, setStoreName] = useState('');
  const [businessType, setBusinessType] = useState('Cafe');
  const [businessDescription, setBusinessDescription] = useState('');
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeAddress, setStoreAddress] = useState('');
  const [operasionalHours, setOperasionalHours] = useState('08:00 - 22:00');

  // Step 3 Form States (Phone OTP)
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [otpErrorCount, setOtpErrorCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeLeft, setLockTimeLeft] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Step 4 NIK Trial Claim State
  const [nikInput, setNikInput] = useState('');

  // Initialize fields from user
  useEffect(() => {
    if (user) {
      setFullName(user.name || '');
      if (user.username) setUsernameInput(user.username);
    }
  }, [user]);

  // Route protection
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (user?.role === 'SUPER_ADMIN') {
        router.push('/superadmin');
      } else if (user?.status === 'ACTIVE') {
        router.push('/dashboard');
      }
    }
  }, [user, isAuthenticated, isLoading, router]);

  // Automatically calculate Age from birthDate
  useEffect(() => {
    if (birthDate) {
      const birth = new Date(birthDate);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        calculatedAge--;
      }
      setAge(calculatedAge >= 0 ? calculatedAge : 0);
    } else {
      setAge(null);
    }
  }, [birthDate]);

  // Cooldown countdown timer for OTP Resend
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  // Lockout countdown timer
  useEffect(() => {
    if (isLocked && lockTimeLeft > 0) {
      const timer = setInterval(() => {
        setLockTimeLeft((prev) => {
          if (prev <= 1) {
            setIsLocked(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isLocked, lockTimeLeft]);

  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Convert uploaded logo file to Base64
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStoreLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Profile Form Submit
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !birthPlace || !birthDate || !address || !province || !city || !district || !postalCode || !storeName || !storeAddress) {
      setErrorMsg('Semua data wajib diisi.');
      return;
    }

    if (usernameInput) {
      if (usernameInput.length < 6 || usernameInput.length > 30) {
        setErrorMsg('Username harus 6 - 30 karakter.');
        return;
      }
      if (!/^[a-zA-Z0-9._]+$/.test(usernameInput)) {
        setErrorMsg('Username hanya boleh mengandung huruf, angka, underscore (_), dan titik (.).');
        return;
      }
    }

    if (passwordInput || confirmPasswordInput) {
      if (passwordInput !== confirmPasswordInput) {
        setErrorMsg('Konfirmasi password tidak cocok.');
        return;
      }
      if (passwordInput.length < 8) {
        setErrorMsg('Password minimal 8 karakter.');
        return;
      }
      if (!/[A-Z]/.test(passwordInput)) {
        setErrorMsg('Password minimal mengandung 1 huruf besar.');
        return;
      }
      if (!/[a-z]/.test(passwordInput)) {
        setErrorMsg('Password minimal mengandung 1 huruf kecil.');
        return;
      }
      if (!/[0-9]/.test(passwordInput)) {
        setErrorMsg('Password minimal mengandung 1 angka.');
        return;
      }
      if (!/[^A-Za-z0-9]/.test(passwordInput)) {
        setErrorMsg('Password minimal mengandung 1 karakter spesial (!@#$%^&* dll).');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await api.post('/auth/profile/complete', {
        name: fullName,
        birthPlace,
        birthDate,
        gender,
        address,
        province,
        city,
        district,
        postalCode,
        storeName,
        businessType,
        businessDescription,
        storeLogo,
        storeAddress,
        username: usernameInput || undefined,
        password: passwordInput || undefined,
        confirmPassword: confirmPasswordInput || undefined,
      });

      // Update local state store
      updateUser({ 
        name: fullName, 
        username: response.user?.username || usernameInput || user.username,
        status: 'PHONE_UNVERIFIED' 
      });
      setPhoneNumber(phoneNumber || '');
      setSuccessMsg('Profil bisnis & kredensial berhasil disimpan!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menyimpan profil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle NIK Trial Claim
  const handleClaimNik = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nikInput || nikInput.length !== 16 || !/^\d{16}$/.test(nikInput)) {
      setErrorMsg('NIK harus 16 digit angka.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.post('/subscriptions/trial/claim', { nik: nikInput });
      updateUser({ status: 'PENDING_APPROVAL' });
      setSuccessMsg('🎉 Selamat! Bonus Premium 30 Hari Anda berhasil diklaim!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal mengklaim Bonus Premium. NIK sudah pernah digunakan?');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Send OTP (Firebase SMS + Fallback to Backend)
  const handleSendOTP = async () => {
    if (!phoneNumber) {
      setErrorMsg('Nomor telepon wajib diisi untuk verifikasi OTP.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Format phone number to international (+62...)
    let formattedPhone = phoneNumber.trim().replace(/[^0-9+]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+62' + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    try {
      // 1. Try Firebase SMS OTP
      if (typeof window !== 'undefined' && auth) {
        // Clear DOM element to avoid 'reCAPTCHA has already been rendered'
        const container = document.getElementById('recaptcha-container');
        if (container) {
          container.innerHTML = '';
        }
        
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {},
        });

        const appVerifier = (window as any).recaptchaVerifier;
        const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
        setConfirmationResult(result);
        setIsOtpSent(true);
        setCooldown(60);
        setResendCount((prev) => prev + 1);
        setSuccessMsg(`Kode SMS OTP 6 digit berhasil dikirim oleh Google Firebase ke ${formattedPhone}!`);
        setIsSubmitting(false);
        return;
      }
    } catch (firebaseErr: any) {
      console.error('[Firebase Auth Error]', firebaseErr);
      const container = document.getElementById('recaptcha-container');
      if (container) container.innerHTML = '';
      (window as any).recaptchaVerifier = null;

      setErrorMsg(`Gagal pengiriman SMS Firebase (${firebaseErr.code || firebaseErr.message || 'Error'}). Silakan coba lagi.`);
      setIsSubmitting(false);
      return;
    }

    // 2. Fallback to Backend OTP
    try {
      const res = await api.post('/auth/otp/send', { phone: phoneNumber });
      setIsOtpSent(true);
      setCooldown(res.resendCooldown || 60);
      setResendCount((prev) => prev + 1);
      setSuccessMsg('Kode OTP 6 digit berhasil dikirim!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal mengirim OTP. Terlalu banyak mencoba?');
      if (err.message && err.message.includes('tercapai')) {
        setIsLocked(true);
        setLockTimeLeft(900); // 15 mins lock
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setErrorMsg('Kode OTP harus 6 digit.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (confirmationResult) {
        // Confirm via Firebase SMS OTP
        await confirmationResult.confirm(otpCode);
        const res = await api.post('/auth/otp/verify', { code: otpCode, isFirebase: true, phone: phoneNumber });
        updateUser({ 
          status: 'PENDING_APPROVAL',
          username: res.user?.username,
          hasPassword: res.user?.hasPassword,
          phoneVerified: true,
        });

        if (res.user && !res.user.hasPassword) {
          setSubStep('CREATE_PASSWORD');
          setSuccessMsg('Verifikasi nomor telepon via SMS Firebase berhasil! Silakan tentukan password akun Anda.');
        } else {
          setSubStep('REGISTRATION_SUCCESS');
          setSuccessMsg('Registrasi Berhasil!');
        }
        setIsSubmitting(false);
        return;
      }

      // Backend OTP Verify fallback
      const res = await api.post('/auth/otp/verify', { code: otpCode });
      updateUser({ 
        status: 'PENDING_APPROVAL',
        username: res.user?.username,
        hasPassword: res.user?.hasPassword,
        phoneVerified: true,
      });

      if (res.user && !res.user.hasPassword) {
        setSubStep('CREATE_PASSWORD');
        setSuccessMsg('Verifikasi nomor telepon berhasil! Silakan tentukan password akun Anda.');
      } else {
        setSubStep('REGISTRATION_SUCCESS');
        setSuccessMsg('Registrasi Berhasil!');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Kode OTP salah.');
      setOtpErrorCount((prev) => prev + 1);
      if (err.message && err.message.includes('dikunci')) {
        setIsLocked(true);
        setLockTimeLeft(900);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Create Initial Password
  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setErrorMsg('Password dan Konfirmasi Password wajib diisi.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.');
      return;
    }

    // Rules validation
    if (newPassword.length < 8) {
      setErrorMsg('Password minimal 8 karakter.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setErrorMsg('Password minimal mengandung 1 huruf besar.');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setErrorMsg('Password minimal mengandung 1 huruf kecil.');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setErrorMsg('Password minimal mengandung 1 angka.');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setErrorMsg('Password minimal mengandung 1 karakter spesial (!@#$%^&* dll).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.post('/auth/password/create', {
        password: newPassword,
        confirmPassword,
      });

      updateUser({
        hasPassword: true,
        username: res.user?.username || user?.username,
      });

      setSubStep('REGISTRATION_SUCCESS');
      setSuccessMsg('Password berhasil disimpan! Registrasi akun Anda telah selesai.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menyimpan password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Request Profile Reset (For Rejected Users)
  const handleResetProfile = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.post('/auth/profile/reset', {});
      updateUser({ status: 'PROFILE_INCOMPLETE' });
      setSuccessMsg('Silakan perbaiki data profil Anda.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal mereset status profil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stepper Header Component
  const renderStepsHeader = (currentStep: number) => {
    const steps = [
      { id: 1, label: 'Google Login' },
      { id: 2, label: 'Verifikasi HP' },
      { id: 3, label: 'Lengkapi Profil' },
      { id: 4, label: 'Akun Aktif' },
    ];

    return (
      <div className="flex items-center justify-between w-full max-w-xl mx-auto mb-8 bg-white dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 backdrop-blur-sm shadow-sm">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5 z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                currentStep > step.id
                  ? 'bg-blue-600 text-white border border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                  : currentStep === step.id
                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-500/50 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-500 border border-slate-200 dark:border-slate-850'
              }`}>
                {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
              </div>
              <span className={`text-[10px] font-bold tracking-wide transition-colors ${
                currentStep === step.id ? 'text-blue-600 dark:text-blue-400 font-bold' : currentStep > step.id ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'
              }`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-[2px] flex-1 mx-2 transition-all duration-300 ${
                currentStep > step.id ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-850'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-[130px] pointer-events-none" />

      {/* Dynamic wizard steps layout */}
      {user.status === 'PROFILE_INCOMPLETE' && renderStepsHeader(2)}
      {user.status === 'PHONE_UNVERIFIED' && renderStepsHeader(3)}
      {user.status === 'PENDING_APPROVAL' && renderStepsHeader(4)}

      <div className="w-full max-w-4xl mx-auto z-10">
        {/* Error / Success Alerts */}
        {errorMsg && (
          <div className="mb-4 max-w-lg mx-auto p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2.5 backdrop-blur-sm animate-shake">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 max-w-lg mx-auto p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2.5 backdrop-blur-sm">
            <Check className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* -------------------- STEP 2: PROFILE FORM -------------------- */}
        {user.status === 'PROFILE_INCOMPLETE' && (
          <Card className="border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/50 backdrop-blur-md shadow-2xl">
            <CardHeader className="border-b border-slate-100 dark:border-slate-850 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg md:text-xl font-black text-slate-900 dark:text-white">Lengkapi Profil Bisnis Anda</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">Isi data identitas diri dan informasi toko untuk verifikasi akun.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleProfileSubmit} className="flex flex-col gap-6">
                
                {/* Personal Info Group */}
                <div>
                  <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase mb-4 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Data Pribadi Owner
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input
                      id="fullName"
                      type="text"
                      label="Nama Lengkap"
                      placeholder="Budi Setiawan"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                    <Input
                      id="birthPlace"
                      type="text"
                      label="Tempat Lahir"
                      placeholder="Semarang"
                      value={birthPlace}
                      onChange={(e) => setBirthPlace(e.target.value)}
                      required
                    />
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Input
                          id="birthDate"
                          type="date"
                          label="Tanggal Lahir"
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Umur</label>
                        <div className="h-10 px-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg flex items-center justify-center text-sm font-bold text-slate-800 dark:text-slate-300">
                          {age !== null ? `${age} th` : '-'}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="gender" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Jenis Kelamin</label>
                      <select
                        id="gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value as any)}
                        className="w-full h-10 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="MALE">Laki-laki</option>
                        <option value="FEMALE">Perempuan</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 mt-4">
                    <div className="md:col-span-2">
                      <Input
                        id="address"
                        type="text"
                        label="Alamat Lengkap KTP"
                        placeholder="Jl. Pemuda No. 120, Sekayu"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        required
                      />
                    </div>
                    <Input
                      id="postalCode"
                      type="text"
                      label="Kode Pos"
                      placeholder="50132"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 mt-4">
                    <Input
                      id="district"
                      type="text"
                      label="Kecamatan"
                      placeholder="Semarang Tengah"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      required
                    />
                    <Input
                      id="city"
                      type="text"
                      label="Kota / Kabupaten"
                      placeholder="Kota Semarang"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                    />
                    <Input
                      id="province"
                      type="text"
                      label="Provinsi"
                      placeholder="Jawa Tengah"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      required
                    />
                  </div>

                  {/* Kredensial Login Owner (Username & Password) */}
                  <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800/60 flex flex-col gap-4">
                    <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-blue-500" /> Kredensial Akun (Username & Password Login)
                    </span>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Input
                          id="regUsername"
                          type="text"
                          label="Username"
                          placeholder="owner_kopi"
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value.toLowerCase().trim())}
                          leftIcon={<User className="h-4 w-4" />}
                          required
                        />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                          6-30 karakter (huruf, angka, _, .)
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
                        <div className="relative">
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            placeholder="Password Baru"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            className="w-full h-10 px-3 pl-10 pr-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                          />
                          <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Konfirmasi Password</label>
                        <div className="relative">
                          <input
                            type={showRegConfirmPassword ? 'text' : 'password'}
                            placeholder="Ulangi Password"
                            value={confirmPasswordInput}
                            onChange={(e) => setConfirmPasswordInput(e.target.value)}
                            className="w-full h-10 px-3 pl-10 pr-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                          />
                          <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <button
                            type="button"
                            onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {showRegConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-slate-200 dark:border-slate-850" />

                {/* Business Info Group */}
                <div>
                  <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase mb-4 flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> Data Usaha / Toko
                  </h3>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <Input
                        id="storeName"
                        type="text"
                        label="Nama Toko / Outlet Utama"
                        placeholder="KopiMu Cafe & Resto"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="businessType" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Jenis Usaha</label>
                      <select
                        id="businessType"
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        className="w-full h-10 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        {[
                          'Cafe', 'Restoran', 'Warung', 'Laundry', 'Minimarket', 
                          'Toko Bangunan', 'Toko Elektronik', 'Fashion', 
                          'Salon', 'Barbershop', 'Apotek', 'Klinik', 'UMKM Lainnya'
                        ].map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <Input
                      id="operasionalHours"
                      type="text"
                      label="Jam Operasional"
                      placeholder="08:00 - 22:00"
                      value={operasionalHours}
                      onChange={(e) => setOperasionalHours(e.target.value)}
                      required
                    />
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5 text-slate-500" /> Logo Toko (Upload Gambar)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          id="storeLogoInput"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById('storeLogoInput')?.click()}
                          className="px-4 h-10 border border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          Pilih File
                        </button>
                        {storeLogo ? (
                          <div className="relative w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={storeLogo} alt="Logo Preview" className="object-cover w-full h-full" />
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">Logo belum diupload (opsional)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 mt-4">
                    <div>
                      <label htmlFor="businessDescription" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Deskripsi Usaha</label>
                      <textarea
                        id="businessDescription"
                        placeholder="Deskripsikan bisnis Anda secara singkat..."
                        value={businessDescription}
                        onChange={(e) => setBusinessDescription(e.target.value)}
                        className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px]"
                      />
                    </div>
                    <Input
                      id="storeAddress"
                      type="text"
                      label="Alamat Toko / Outlet"
                      placeholder="Ruko Kav 5, Jl. Pemuda No. 120"
                      value={storeAddress}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4">
                  <Button
                    type="button"
                    onClick={handleLogout}
                    variant="outline"
                    className="border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Keluar Sesi
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="bg-blue-600! hover:bg-blue-700! text-white font-bold cursor-pointer"
                    isLoading={isSubmitting}
                  >
                    Simpan & Lanjutkan
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* -------------------- STEP 3: PHONE OTP VERIFICATION -------------------- */}
        {user.status === 'PHONE_UNVERIFIED' && (
          <Card className="border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/50 backdrop-blur-md shadow-2xl max-w-lg mx-auto">
            <CardHeader className="border-b border-slate-100 dark:border-slate-850 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black text-slate-900 dark:text-white">Verifikasi Nomor Telepon</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">Masukkan nomor telepon aktif untuk menerima kode verifikasi OTP.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div id="recaptcha-container"></div>
              <div className="flex flex-col gap-6">
                
                {/* Step 3a: Input phone number & request OTP */}
                <div className="flex flex-col gap-4">
                  <Input
                    id="phone"
                    type="text"
                    label="Nomor WhatsApp / SMS (e.g. 08123456789)"
                    placeholder="08xxxxxxxxxx"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    leftIcon={<Phone className="h-4 w-4" />}
                    disabled={isOtpSent && cooldown > 0}
                    required
                  />

                  <Button
                    type="button"
                    onClick={handleSendOTP}
                    variant="outline"
                    className="w-full border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                    disabled={isSubmitting || cooldown > 0 || isLocked}
                  >
                    {isLocked ? (
                      `Percobaan Terkunci`
                    ) : cooldown > 0 ? (
                      `Kirim Ulang OTP dalam ${cooldown}s`
                    ) : isOtpSent ? (
                      'Kirim Ulang Kode OTP'
                    ) : (
                      'Kirim Kode OTP'
                    )}
                  </Button>

                  {resendCount > 0 && !isLocked && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-500 text-center">
                      Percobaan kirim ulang OTP: {resendCount}/3 kali
                    </span>
                  )}
                </div>

                {isLocked && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 rounded-xl text-center flex flex-col items-center gap-2">
                    <Lock className="h-8 w-8 text-red-500 animate-bounce" />
                    <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">Batas Percobaan OTP Terlampaui</h4>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">
                      Anda telah memasukkan OTP yang salah 5 kali atau mencapai batas kirim ulang. Akun dikunci sementara.
                    </p>
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 mt-1">
                      Coba lagi dalam: {Math.floor(lockTimeLeft / 60)}m {lockTimeLeft % 60}s
                    </span>
                  </div>
                )}

                {/* Step 3b: Input OTP code */}
                {isOtpSent && !isLocked && (
                  <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4 border-t border-slate-100 dark:border-slate-850 pt-4 animate-fade-in">
                    <Input
                      id="otpCode"
                      type="text"
                      label="Masukkan 6 Digit OTP"
                      placeholder="••••••"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      maxLength={6}
                      leftIcon={<KeyRound className="h-4 w-4" />}
                      className="text-center font-black tracking-widest text-lg"
                      required
                      disabled={isSubmitting}
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full bg-blue-600! hover:bg-blue-700! text-white font-bold cursor-pointer"
                      isLoading={isSubmitting}
                    >
                      Verifikasi Kode OTP
                    </Button>
                  </form>
                )}

                {/* Development Mock Log Help */}
                {process.env.NODE_ENV === 'development' && isOtpSent && !isLocked && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/30 p-3.5 rounded-xl text-left leading-relaxed text-[11px] text-slate-600 dark:text-slate-400 flex flex-col gap-1">
                    <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> [SIMULASI LOCAL DEV]
                    </span>
                    <span>Kode OTP telah tersimpan ke dalam file log backend Anda.</span>
                    <span className="text-slate-800 dark:text-slate-200 mt-1 bg-white dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-900 font-mono text-center">
                      Cek file log di: <code className="text-blue-600 dark:text-blue-300">backend/logs/otp.log</code>
                    </span>
                  </div>
                )}

                <div className="flex gap-4 justify-between border-t border-slate-100 dark:border-slate-850 pt-4 mt-2">
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold cursor-pointer"
                  >
                    Keluar Sesi
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* -------------------- SUBSTEP: CREATE PASSWORD (IF USER HAS NO PASSWORD) -------------------- */}
        {user.status === 'PHONE_UNVERIFIED' && subStep === 'CREATE_PASSWORD' && (
          <Card className="border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/60 backdrop-blur-md shadow-2xl max-w-lg mx-auto animate-fade-in">
            <CardHeader className="border-b border-slate-100 dark:border-slate-850 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black text-slate-900 dark:text-white">Buat Password Akun</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">Buat password yang kuat untuk mengamankan akun KasirMu Anda.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreatePassword} className="flex flex-col gap-5">
                
                {/* Password Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Masukkan Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2.5 pl-10 pr-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Konfirmasi Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Konfirmasi Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2.5 pl-10 pr-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Rules Checklist */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-850 rounded-xl flex flex-col gap-2 text-[11px]">
                  <span className="font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Ketentuan Password:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-600 dark:text-slate-400">
                    <div className={`flex items-center gap-1.5 ${newPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
                      <Check className="h-3.5 w-3.5" /> Minimal 8 karakter
                    </div>
                    <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
                      <Check className="h-3.5 w-3.5" /> Minimal 1 huruf besar
                    </div>
                    <div className={`flex items-center gap-1.5 ${/[a-z]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
                      <Check className="h-3.5 w-3.5" /> Minimal 1 huruf kecil
                    </div>
                    <div className={`flex items-center gap-1.5 ${/[0-9]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
                      <Check className="h-3.5 w-3.5" /> Minimal 1 angka
                    </div>
                    <div className={`flex items-center gap-1.5 sm:col-span-2 ${/[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
                      <Check className="h-3.5 w-3.5" /> Minimal 1 karakter spesial (!@#$%^&* dll)
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full bg-blue-600! hover:bg-blue-700! text-white font-bold py-3 rounded-xl cursor-pointer mt-2"
                  isLoading={isSubmitting}
                >
                  Simpan Password
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* -------------------- SUBSTEP: REGISTRATION SUCCESS SCREEN -------------------- */}
        {subStep === 'REGISTRATION_SUCCESS' && (
          <Card className="border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/60 backdrop-blur-md shadow-2xl max-w-lg mx-auto border-emerald-500/30 animate-fade-in">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                  <CheckCircle2 className="h-14 w-14 text-emerald-600 dark:text-emerald-400 animate-bounce" />
                </div>
              </div>
              <CardTitle className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                🎉 Registrasi Berhasil
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-300 text-xs md:text-sm mt-2 leading-relaxed">
                Selamat! Akun KasirMu Anda berhasil dibuat. Silakan login untuk mulai menggunakan aplikasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 flex flex-col gap-6">
              
              {/* Account Info Details */}
              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col gap-3 shadow-inner">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-xs tracking-wider uppercase pb-2 border-b border-slate-200 dark:border-slate-850 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-500" /> Ringkasan Akun KasirMu
                </h3>

                <div className="grid gap-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-900">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Nama:</span>
                    <span className="text-slate-900 dark:text-white font-bold">{user?.name || '-'}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-900">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Username:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono font-bold bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/60">
                      {user?.username || (user?.email ? user.email.split('@')[0] : '-')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-900">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Email:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium">{user?.email || '-'}</span>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Status:</span>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Email Terverifikasi
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Nomor HP Terverifikasi
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center text-xs text-slate-600 dark:text-slate-400 leading-relaxed px-2">
                Silakan klik <strong className="text-slate-900 dark:text-white">Login Sekarang</strong> untuk masuk menggunakan Username / Email dan Password Anda.
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push('/login?role=owner');
                  }}
                  variant="primary"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-3 rounded-xl shadow-lg shadow-blue-900/30 cursor-pointer flex items-center justify-center gap-2"
                >
                  Login Sekarang
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Kembali ke Beranda
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* -------------------- STEP 4: PENDING APPROVAL SCREEN -------------------- */}
        {user.status === 'PENDING_APPROVAL' && (
          <Card className="border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/50 backdrop-blur-md shadow-2xl max-w-lg mx-auto">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20 animate-pulse">
                  <Clock className="h-10 w-10" />
                </div>
              </div>
              <CardTitle className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Pendaftaran Sedang Ditinjau</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400 text-xs md:text-sm mt-2 leading-relaxed">
                Halo! Akun owner Anda sedang dalam proses verifikasi dan peninjauan akhir oleh administrator platform KasirMu.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 flex flex-col gap-6 text-center">
              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-850 p-4 rounded-xl text-left text-xs leading-relaxed text-slate-700 dark:text-slate-350">
                <h3 className="font-bold text-slate-900 dark:text-white mb-2 pb-1 border-b border-slate-200 dark:border-slate-850 flex items-center gap-1.5">
                  <Store className="h-4 w-4 text-blue-500" /> Ringkasan Pendaftaran:
                </h3>
                <div className="grid gap-1">
                  <p><span className="text-slate-500 dark:text-slate-400 font-semibold">Nama Bisnis:</span> {user.name}</p>
                  <p><span className="text-slate-500 dark:text-slate-400 font-semibold">Email Google:</span> {user.email}</p>
                  <p><span className="text-slate-500 dark:text-slate-400 font-semibold">Status:</span> 
                    <span className="ml-1.5 px-2 py-0.5 rounded text-[9px] font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/20 uppercase">
                      Pending Review
                    </span>
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                Proses peninjauan biasanya memakan waktu maksimal 1x24 jam kerja. Anda akan menerima notifikasi status akun Anda via email.
              </div>

              <div className="flex justify-center gap-4 mt-2">
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="flex items-center gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 font-bold cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar Sesi
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* -------------------- REJECTED STATE SCREEN -------------------- */}
        {user.status === 'REJECTED' && (
          <Card className="border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/50 backdrop-blur-md shadow-2xl max-w-lg mx-auto">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                  <ShieldAlert className="h-10 w-10" />
                </div>
              </div>
              <CardTitle className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Registrasi Akun Ditolak</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400 text-xs md:text-sm mt-2">
                Mohon maaf, permohonan pendaftaran mitra owner baru Anda ditolak karena belum memenuhi kriteria platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 flex flex-col gap-6 text-center">
              
              <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-500/20 p-4 rounded-xl text-left text-xs leading-relaxed text-red-600 dark:text-red-400">
                <h3 className="font-bold text-slate-900 dark:text-white mb-1">Pesan dari Administrator:</h3>
                <p>Data profil atau usaha yang Anda kirimkan dinilai tidak valid atau tidak memenuhi kriteria administrasi.</p>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Anda dapat memperbarui data profil dan toko Anda dengan data yang valid untuk mengirim ulang permintaan persetujuan.
              </div>

              <div className="flex gap-4 justify-center mt-2">
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-850 font-bold cursor-pointer"
                >
                  Keluar Sesi
                </Button>
                <Button
                  onClick={handleResetProfile}
                  variant="primary"
                  className="bg-blue-600! hover:bg-blue-700! text-white font-bold cursor-pointer flex items-center gap-1.5"
                  isLoading={isSubmitting}
                >
                  <RefreshCw className="h-4 w-4" />
                  Daftar Ulang & Edit Profil
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* -------------------- SUSPENDED STATE SCREEN -------------------- */}
        {user.status === 'SUSPENDED' && (
          <Card className="border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/50 backdrop-blur-md shadow-2xl max-w-lg mx-auto">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                  <AlertOctagon className="h-10 w-10" />
                </div>
              </div>
              <CardTitle className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Akun Anda Ditangguhkan</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400 text-xs md:text-sm mt-2 leading-relaxed">
                Akun owner Anda dinonaktifkan sementara karena melanggar ketentuan operasional atau masalah administratif.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 flex flex-col gap-6 text-center">
              <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Untuk mengajukan banding, mendapatkan klarifikasi, atau mengaktifkan kembali akun Anda, silakan hubungi customer support di <span className="text-blue-600 dark:text-blue-400 underline font-bold">support@kasirmu.com</span>.
              </div>

              <div className="flex justify-center mt-2">
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-850 font-bold cursor-pointer"
                >
                  Keluar Sesi
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
