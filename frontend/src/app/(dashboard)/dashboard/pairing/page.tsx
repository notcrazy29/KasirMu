'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import QRCode from 'qrcode';
import { QrCode, Smartphone, Copy, Check, Lock } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function QRisPairingPage() {
  const { currentStoreId } = useAuthStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pairingCode, setPairingCode] = useState<string>('');
  const [storeName, setStoreName] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Exit PIN Flow
  const [exitPin, setExitPin] = useState<string>('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [pinMessage, setPinMessage] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    const fetchStorePairingData = async () => {
      if (!currentStoreId) return;
      try {
        const response = await api.get(`/stores/${currentStoreId}`);
        setPairingCode(response.store.pairingCode);
        setStoreName(response.store.name);
        setExitPin(response.store.exitPin || '1234');
      } catch (err) {
        console.error('Failed to load store pairing details:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStorePairingData();
  }, [currentStoreId]);

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStoreId || exitPin.length < 4) return;
    setIsUpdatingPin(true);
    setPinMessage('');
    setPinError('');
    try {
      const response = await api.post(`/stores/${currentStoreId}/update-pin`, { pin: exitPin });
      setPinMessage(response.message || 'PIN Otorisasi berhasil diperbarui');
    } catch (err: any) {
      setPinError(err.message || 'Gagal memperbarui PIN keamanan');
    } finally {
      setIsUpdatingPin(false);
    }
  };

  useEffect(() => {
    if (!pairingCode || !canvasRef.current) return;

    // Build pairing object JSON payload
    const payload = JSON.stringify({
      storeId: currentStoreId,
      pairingCode: pairingCode,
    });

    QRCode.toCanvas(
      canvasRef.current,
      payload,
      {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000', // Black pixels
          light: '#ffffff', // White background
        },
      },
      (error) => {
        if (error) console.error('[QR Generator] Error rendering QR Code:', error);
      }
    );
  }, [pairingCode, currentStoreId]);

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Pairing Device Kasir</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Gunakan QR Code ini untuk menghubungkan device atau staf kasir baru</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* Left Column (QR Code & Settings) */}
        <div className="flex flex-col gap-6">
          {/* QR Card */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-6 flex flex-col items-center">
            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-850 flex justify-center items-center shadow-sm">
              <canvas ref={canvasRef} className="rounded-lg" />
            </div>
            <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider mt-4">
              QR CODE PAIRING OUTLET
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white mt-1">{storeName}</span>
          </Card>
        </div>

        {/* Instructions Card */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 p-6 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Smartphone className="h-4.5 w-4.5 text-blue-500 dark:text-blue-400" />
            <span>Cara Menghubungkan Kasir</span>
          </h3>

          <div className="flex flex-col gap-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <div className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">1</span>
              <p>Buka browser di device kasir (tablet / smartphone / PC) dan masuk ke halaman login kasir.</p>
            </div>
            <div className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">2</span>
              <p>Masuk menggunakan akun kasir yang telah Anda daftarkan di menu "Kasir".</p>
            </div>
            <div className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">3</span>
              <p>Klik tombol <strong className="text-slate-800 dark:text-white">"Hubungkan Toko / Pairing"</strong> di dashboard kasir.</p>
            </div>
            <div className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">4</span>
              <p>Arahkan kamera device ke QR Code di samping ini untuk pairing instan, atau masukkan token pairing secara manual di bawah ini.</p>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-2">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 block">TOKEN PAIRING MANUAL</span>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="text"
                readOnly
                value={pairingCode}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono px-3 py-2 text-slate-900 dark:text-white outline-none select-all"
              />
              <button
                onClick={handleCopyCode}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg cursor-pointer transition-colors"
                title="Salin Token"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 flex flex-col gap-2">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 block">PIN OTORISASI KELUAR POS</span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
              PIN pengaman yang harus dimasukkan oleh kasir jika ingin keluar (logout) dari terminal penjualan POS.
            </p>
            <form onSubmit={handleUpdatePin} className="flex items-center gap-2 mt-1">
              <div className="relative w-32 shrink-0">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <Input
                  type="password"
                  required
                  maxLength={6}
                  value={exitPin}
                  onChange={(e) => setExitPin(e.target.value.replace(/\D/g, ''))}
                  className="pl-8 text-center tracking-[0.2em] font-extrabold text-xs"
                />
              </div>
              <Button
                type="submit"
                disabled={isUpdatingPin || exitPin.length < 4}
                className="text-xs font-bold shrink-0"
              >
                {isUpdatingPin ? 'Menyimpan...' : 'Perbarui PIN'}
              </Button>
            </form>
            {pinMessage && (
              <span className="text-[10px] text-emerald-500 font-semibold mt-1">{pinMessage}</span>
            )}
            {pinError && (
              <span className="text-[10px] text-rose-500 font-semibold mt-1">{pinError}</span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
