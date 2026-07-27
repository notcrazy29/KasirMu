'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  ShieldCheck,
  TestTube,
  Clock,
  Building,
  Key,
  Zap,
} from 'lucide-react';

interface PlatformGateway {
  id: string;
  provider: string;
  merchantId: string | null;
  merchantName: string | null;
  clientKey: string | null;
  environment: string;
  status: string;
  connectedAt: string | null;
  updatedAt: string;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function SuperAdminPaymentGatewayPage() {
  const [gateway, setGateway] = useState<PlatformGateway | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Form fields
  const [merchantName, setMerchantName] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [serverKey, setServerKey] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [environment, setEnvironment] = useState<'SANDBOX' | 'PRODUCTION'>('SANDBOX');

  // UI state
  const [showServerKey, setShowServerKey] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [testResult, setTestResult] = useState<{ connected: boolean; message: string } | null>(null);

  // Disconnect confirm
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const loadGateway = async () => {
    setIsLoading(true);
    try {
      const data = await api.get('/superadmin/payment-gateway/platform');
      setGateway(data.status !== 'DISCONNECTED' ? data : null);
      if (data.status === 'CONNECTED') {
        setMerchantName(data.merchantName || '');
        setMerchantId(data.merchantId || '');
        setClientKey(data.clientKey || '');
        setEnvironment(data.environment || 'SANDBOX');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat konfigurasi Payment Gateway');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGateway();
  }, []);

  const clearMessages = () => {
    setSuccessMsg('');
    setErrorMsg('');
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!serverKey || !clientKey) {
      setErrorMsg('Server Key dan Client Key wajib diisi untuk test koneksi');
      return;
    }
    clearMessages();
    setIsTesting(true);
    try {
      const result = await api.post('/superadmin/payment-gateway/platform/test', {
        serverKey,
        clientKey,
        environment,
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ connected: false, message: err.message || 'Gagal test koneksi' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverKey || !clientKey) {
      setErrorMsg('Server Key dan Client Key wajib diisi');
      return;
    }
    clearMessages();
    setIsSaving(true);
    try {
      const result = await api.post('/superadmin/payment-gateway/platform', {
        merchantName,
        merchantId,
        serverKey,
        clientKey,
        environment,
      });
      setSuccessMsg('✅ Konfigurasi Midtrans Platform berhasil disimpan dan terkoneksi');
      setServerKey('');
      await loadGateway();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan konfigurasi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    clearMessages();
    try {
      await api.delete('/superadmin/payment-gateway/platform');
      setSuccessMsg('Konfigurasi Midtrans Platform berhasil dihapus');
      setGateway(null);
      setServerKey('');
      setClientKey('');
      setMerchantId('');
      setMerchantName('');
      setShowDisconnectConfirm(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus konfigurasi');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="text-sm text-slate-400">Memuat konfigurasi...</span>
        </div>
      </div>
    );
  }

  const isConnected = gateway?.status === 'CONNECTED';

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
          <span>Settings</span>
          <span>/</span>
          <span>Payment Gateway</span>
          <span>/</span>
          <span className="text-white font-semibold">Midtrans Platform</span>
        </div>
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-500" />
          Konfigurasi Midtrans Platform
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Akun Midtrans Super Admin yang digunakan untuk <strong className="text-slate-300">seluruh pembayaran Subscription Premium</strong> Owner.
        </p>
      </div>

      {/* Alert Banner */}
      <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-300 leading-relaxed">
          <strong>Keamanan:</strong> Server Key disimpan terenkripsi menggunakan AES-256. Client Key digunakan frontend untuk Midtrans Snap SDK. Webhook validasi menggunakan Signature Key dari akun ini.
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="ml-auto text-emerald-500 hover:text-emerald-300 text-xs">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-950/40 border border-red-500/30 text-red-300 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="ml-auto text-red-500 hover:text-red-300 text-xs">✕</button>
        </div>
      )}

      {/* Connection Status Card */}
      {isConnected && gateway && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-slate-900 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Wifi className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-bold text-emerald-300">Terkoneksi</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Midtrans Platform {gateway.provider}</p>
              </div>
            </div>
            <button
              onClick={() => setShowDisconnectConfirm(true)}
              className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/50 px-3 py-2 rounded-lg transition-all cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Disconnect
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Merchant Name</span>
              <span className="text-sm font-bold text-white">{gateway.merchantName || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Merchant ID</span>
              <span className="text-sm font-bold text-white">{gateway.merchantId || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Environment</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg inline-block ${
                gateway.environment === 'PRODUCTION'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {gateway.environment}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Last Sync</span>
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(gateway.connectedAt)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation */}
      {showDisconnectConfirm && (
        <div className="p-5 rounded-xl bg-red-950/30 border border-red-500/30">
          <p className="text-sm font-bold text-red-300 mb-1">⚠️ Konfirmasi Disconnect</p>
          <p className="text-xs text-slate-400 mb-4">
            Menghapus konfigurasi ini akan menonaktifkan pembayaran Subscription Premium. Owner tidak dapat melakukan pembayaran sampai konfigurasi baru disimpan.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
            >
              {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Ya, Hapus Konfigurasi
            </button>
            <button
              onClick={() => setShowDisconnectConfirm(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
          <Key className="h-4 w-4 text-slate-400" />
          {isConnected ? 'Perbarui Konfigurasi' : 'Tambah Konfigurasi Midtrans'}
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          {isConnected
            ? 'Isi Server Key baru untuk memperbarui. Kosongkan Server Key jika tidak ingin mengubah.'
            : 'Masukkan kredensial Midtrans Super Admin untuk mengaktifkan pembayaran Subscription Premium.'}
        </p>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          {/* Row 1: Merchant Name + Merchant ID */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                Merchant Name
              </label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="Contoh: KasirMu Platform"
                className="px-3 py-2.5 bg-slate-800/60 border border-slate-700/60 text-white text-sm rounded-lg focus:outline-none focus:border-blue-500/60 placeholder:text-slate-600 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                Merchant ID
                <span className="text-slate-600 font-normal">(opsional)</span>
              </label>
              <input
                type="text"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                placeholder="Contoh: G123456789"
                className="px-3 py-2.5 bg-slate-800/60 border border-slate-700/60 text-white text-sm rounded-lg focus:outline-none focus:border-blue-500/60 placeholder:text-slate-600 transition-colors"
              />
            </div>
          </div>

          {/* Row 2: Client Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" />
              Client Key <span className="text-slate-600 font-normal">(digunakan frontend Snap SDK)</span>
            </label>
            <input
              type="text"
              value={clientKey}
              onChange={(e) => setClientKey(e.target.value)}
              placeholder="SB-Mid-client-xxxxxxxxxxxx"
              required
              className="px-3 py-2.5 bg-slate-800/60 border border-slate-700/60 text-white text-sm rounded-lg focus:outline-none focus:border-blue-500/60 placeholder:text-slate-600 font-mono transition-colors"
            />
          </div>

          {/* Row 3: Server Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" />
              Server Key <span className="text-red-400">*</span>
              <span className="text-slate-600 font-normal">(disimpan terenkripsi AES-256)</span>
            </label>
            <div className="relative">
              <input
                type={showServerKey ? 'text' : 'password'}
                value={serverKey}
                onChange={(e) => setServerKey(e.target.value)}
                placeholder={isConnected ? '••••• (kosongkan jika tidak diubah)' : 'SB-Mid-server-xxxxxxxxxxxx'}
                required={!isConnected}
                className="w-full px-3 py-2.5 pr-10 bg-slate-800/60 border border-slate-700/60 text-white text-sm rounded-lg focus:outline-none focus:border-blue-500/60 placeholder:text-slate-600 font-mono transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowServerKey(!showServerKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showServerKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Row 4: Environment */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Environment
            </label>
            <div className="flex gap-3">
              {(['SANDBOX', 'PRODUCTION'] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                    environment === env
                      ? env === 'PRODUCTION'
                        ? 'bg-green-500/10 border-green-500/40 text-green-300'
                        : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {env === 'SANDBOX' ? '🧪 Sandbox (Testing)' : '🚀 Production (Live)'}
                </button>
              ))}
            </div>
            {environment === 'PRODUCTION' && (
              <p className="text-xs text-amber-400 flex items-center gap-1.5 mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Mode Production: transaksi nyata akan diproses dan menggunakan uang asli.
              </p>
            )}
          </div>

          {/* Test Connection Result */}
          {testResult && (
            <div className={`p-3.5 rounded-xl border text-sm flex items-center gap-3 ${
              testResult.connected
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : 'bg-red-950/30 border-red-500/30 text-red-300'
            }`}>
              {testResult.connected
                ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-800/60">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              {isTesting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <TestTube className="h-4 w-4" />}
              {isTesting ? 'Menguji Koneksi...' : 'Test Connection'}
            </button>

            <button
              type="submit"
              disabled={isSaving || isTesting}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 cursor-pointer"
            >
              {isSaving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle2 className="h-4 w-4" />}
              {isSaving ? 'Menyimpan...' : isConnected ? 'Perbarui Konfigurasi' : 'Simpan & Aktifkan'}
            </button>

            {isConnected && (
              <button
                type="button"
                onClick={loadGateway}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Info Box */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-5">
        <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Cara Mendapatkan Kredensial Midtrans</h3>
        <ol className="flex flex-col gap-2 text-xs text-slate-500 list-decimal list-inside leading-relaxed">
          <li>Login ke <strong className="text-slate-300">dashboard.midtrans.com</strong></li>
          <li>Pilih mode <strong className="text-slate-300">Sandbox</strong> (untuk testing) atau <strong className="text-slate-300">Production</strong></li>
          <li>Buka menu <strong className="text-slate-300">Settings → Access Keys</strong></li>
          <li>Salin <strong className="text-slate-300">Server Key</strong> dan <strong className="text-slate-300">Client Key</strong></li>
          <li>Merchant ID ada di bagian atas halaman Access Keys</li>
        </ol>
      </div>
    </div>
  );
}
