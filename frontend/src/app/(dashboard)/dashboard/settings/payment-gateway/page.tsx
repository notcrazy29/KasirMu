'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Plug,
  PlugZap,
  AlertCircle,
  Info,
  ExternalLink,
  Lock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

type Environment = 'SANDBOX' | 'PRODUCTION';

interface GatewayStatus {
  status: 'CONNECTED' | 'DISCONNECTED';
  provider?: string;
  merchantId?: string;
  clientKey?: string;
  environment?: Environment;
  connectedAt?: string;
}

// ── Reusable UpgradeWall component ──
function UpgradeWall() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center gap-6 px-4">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center border border-amber-500/30">
          <Lock className="h-8 w-8 text-amber-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
          <Sparkles className="h-3 w-3 text-white" />
        </div>
      </div>

      <div className="max-w-sm">
        <h2 className="text-lg font-extrabold text-white mb-2">Fitur PREMIUM Diperlukan</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Menghubungkan Payment Gateway Midtrans untuk menerima{' '}
          <strong className="text-slate-200">QRIS, GoPay, Bank Transfer, Kartu Kredit</strong>{' '}
          dan semua metode pembayaran digital hanya tersedia untuk pelanggan paket{' '}
          <span className="text-amber-400 font-bold">PREMIUM</span>.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/dashboard/subscription"
          className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:-translate-y-0.5"
        >
          <Sparkles className="h-4 w-4" />
          Upgrade ke PREMIUM
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="text-xs text-slate-500 text-center">
          Mulai dari{' '}
          <span className="text-white font-bold">Rp80.000</span>/bulan
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm text-left">
        {[
          'QRIS Dinamis',
          'GoPay & ShopeePay',
          'Bank Transfer VA',
          'Kartu Kredit',
          'Indomaret & Alfamart',
          'Webhook Realtime',
        ].map((feat) => (
          <div key={feat} className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>{feat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PaymentGatewayPage() {
  const { currentStoreId } = useAuthStore();
  const { canUse, isLoading: subLoading, isInitialized } = useSubscriptionStore();
  const canUseMidtrans = canUse('canUseMidtrans');

  const [gateway, setGateway] = useState<GatewayStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Form state
  const [merchantId, setMerchantId] = useState('');
  const [serverKey, setServerKey] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [environment, setEnvironment] = useState<Environment>('SANDBOX');
  const [showServerKey, setShowServerKey] = useState(false);

  // Action state
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchGatewayStatus = useCallback(async () => {
    if (!currentStoreId) return;
    setIsLoadingStatus(true);
    try {
      const res = await api.get(`/stores/${currentStoreId}/payment-gateway`);
      setGateway(res);
      if (res.status === 'CONNECTED') {
        setEnvironment(res.environment || 'SANDBOX');
        setMerchantId(res.merchantId || '');
      }
    } catch (err) {
      console.error('Failed to fetch gateway status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [currentStoreId]);

  useEffect(() => {
    fetchGatewayStatus();
  }, [fetchGatewayStatus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStoreId) return;

    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await api.post(`/stores/${currentStoreId}/payment-gateway`, {
        merchantId,
        serverKey,
        clientKey,
        environment,
      });

      setSuccessMsg(res.message || 'Koneksi Midtrans berhasil disimpan');
      setServerKey('');
      setClientKey('');
      await fetchGatewayStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal terhubung ke Midtrans. Silakan periksa Server Key, Client Key, Merchant ID, dan Environment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentStoreId) return;
    if (!confirm('Nonaktifkan Payment Gateway Midtrans? Kasir tidak akan dapat memproses pembayaran digital hingga dihubungkan kembali.')) return;

    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await api.post(`/stores/${currentStoreId}/payment-gateway`, {
        merchantId: '',
        serverKey: '',
        clientKey: '',
        environment,
      });
      setSuccessMsg(res.message || 'Payment Gateway dinonaktifkan');
      await fetchGatewayStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menonaktifkan Payment Gateway');
    } finally {
      setIsSaving(false);
    }
  };

  const isConnected = gateway?.status === 'CONNECTED';

  // Show upgrade wall if subscription check complete and feature is locked
  if (isInitialized && !canUseMidtrans) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Payment Gateway
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Hubungkan akun Midtrans untuk menerima pembayaran digital
          </p>
        </div>
        <UpgradeWall />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Payment Gateway
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Hubungkan akun Midtrans Anda agar kasir dapat menerima semua metode pembayaran digital secara langsung
        </p>
      </div>

      {/* Status Card */}
      <div className={`rounded-2xl border p-5 flex items-center gap-4 transition-all ${
        isLoadingStatus
          ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40'
          : isConnected
          ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20'
          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40'
      }`}>
        <div className={`p-3 rounded-xl shrink-0 ${isConnected ? 'bg-emerald-500/10' : 'bg-slate-200 dark:bg-slate-800'}`}>
          {isLoadingStatus ? (
            <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
          ) : isConnected ? (
            <PlugZap className="h-6 w-6 text-emerald-500" />
          ) : (
            <Plug className="h-6 w-6 text-slate-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900 dark:text-white">Midtrans</span>
            {!isLoadingStatus && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                isConnected
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            )}
            {isConnected && gateway?.environment && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                gateway.environment === 'PRODUCTION'
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}>
                {gateway.environment}
              </span>
            )}
          </div>

          {isConnected && gateway?.connectedAt && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Terhubung sejak {new Date(gateway.connectedAt).toLocaleDateString('id-ID', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          )}

          {!isLoadingStatus && !isConnected && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Isi form di bawah untuk menghubungkan akun Midtrans
            </p>
          )}
        </div>

        {isConnected && (
          <button
            onClick={handleDisconnect}
            disabled={isSaving}
            className="shrink-0 text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Putuskan
          </button>
        )}
      </div>

      {/* Info Banner */}
      <div className="flex gap-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-700 dark:text-blue-300 space-y-1 leading-relaxed">
          <p className="font-bold text-xs">Cara kerja integrasi ini:</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-600 dark:text-blue-400">
            <li>Server Key Anda dienkripsi AES-256 sebelum disimpan di database</li>
            <li>Kasir tidak pernah melihat Server Key maupun Client Key</li>
            <li>Popup Midtrans Snap yang tampil adalah popup resmi dari Midtrans</li>
            <li>Semua metode pembayaran aktif di akun Midtrans Anda akan otomatis tersedia</li>
            <li>QRIS, GoPay, ShopeePay, VA, Kartu Kredit, dll — sesuai konfigurasi akun Anda</li>
          </ul>
          <a
            href="https://dashboard.sandbox.midtrans.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Buka Midtrans Dashboard <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Config Form */}
      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="h-4.5 w-4.5 text-blue-500" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {isConnected ? 'Perbarui Kredensial Midtrans' : 'Hubungkan Akun Midtrans'}
          </h2>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Environment Toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Environment
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
              {(['SANDBOX', 'PRODUCTION'] as Environment[]).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  className={`py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    environment === env
                      ? env === 'PRODUCTION'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {env === 'SANDBOX' ? '🧪 Sandbox' : '🚀 Production'}
                </button>
              ))}
            </div>
            {environment === 'PRODUCTION' && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Mode Produksi: transaksi akan diproses secara nyata
              </p>
            )}
          </div>

          {/* Merchant ID */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Merchant ID <span className="text-slate-400 normal-case font-normal">(opsional)</span>
            </label>
            <input
              type="text"
              placeholder="M1234567890"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs font-mono text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Server Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Server Key <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showServerKey ? 'text' : 'password'}
                placeholder={environment === 'SANDBOX' ? 'SB-Mid-server-...' : 'Mid-server-...'}
                value={serverKey}
                onChange={(e) => setServerKey(e.target.value)}
                required={!isConnected}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 pr-10 text-xs font-mono text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowServerKey(!showServerKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                {showServerKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Shield className="h-3 w-3 text-green-500" />
              Server Key dienkripsi AES-256 sebelum disimpan. Tidak pernah ditampilkan kembali.
            </p>
          </div>

          {/* Client Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Client Key <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder={environment === 'SANDBOX' ? 'SB-Mid-client-...' : 'Mid-client-...'}
              value={clientKey}
              onChange={(e) => setClientKey(e.target.value)}
              required={!isConnected}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs font-mono text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Messages */}
          {successMsg && (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-xl px-4 py-3">
              <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-400">{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menguji Koneksi...</span>
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                <span>{isConnected ? 'Perbarui & Tes Koneksi' : 'Hubungkan & Tes Koneksi'}</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* How it works for cashier */}
      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Alur Pembayaran Kasir</h3>
        <div className="flex flex-col gap-3">
          {[
            { step: '1', title: 'Kasir pilih produk & klik Bayar', desc: 'Kasir tidak perlu tahu credential apapun' },
            { step: '2', title: 'Backend mengambil kredensial terenkripsi', desc: 'Berdasarkan Store ID toko tempat kasir bertugas' },
            { step: '3', title: 'Server Key didekripsi & Snap token dibuat', desc: 'Transaksi dibuat via Midtrans Snap API' },
            { step: '4', title: 'Popup Midtrans resmi muncul di layar kasir', desc: 'Menampilkan semua channel pembayaran aktif di akun Anda' },
            { step: '5', title: 'Webhook Midtrans diterima backend', desc: 'Status transaksi diperbarui & dashboard Owner terupdate real-time' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                {item.step}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.title}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
