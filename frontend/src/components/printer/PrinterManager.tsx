'use client';

import React, { useEffect, useState } from 'react';
import { usePrinterStore } from '@/store/usePrinterStore';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { 
  Printer, 
  Bluetooth, 
  RefreshCw, 
  Unplug, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Info,
  Search,
  Check
} from 'lucide-react';

export default function PrinterManager() {
  const {
    status,
    deviceName,
    deviceId,
    lastConnected,
    errorMessage,
    isSupported,
    init,
    connectPrinter,
    disconnectPrinter,
    autoReconnect,
    printTestReceipt,
    clearError,
  } = usePrinterStore();

  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  const handleTestPrint = async () => {
    setIsTesting(true);
    setTestSuccess(false);
    clearError();
    try {
      const success = await printTestReceipt();
      if (success) {
        setTestSuccess(true);
        setTimeout(() => setTestSuccess(false), 3000);
      }
    } finally {
      setIsTesting(false);
    }
  };

  const isConnected = status === 'CONNECTED';
  const isConnecting = status === 'CONNECTING';

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Unsupported Browser / Non-HTTPS Warning */}
      {!isSupported && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold block text-sm">Fitur Bluetooth Tidak Aktif / Butuh HTTPS</span>
            <p>
              Browser hanya mengizinkan akses Web Bluetooth API jika website diakses melalui koneksi aman <strong>HTTPS (`https://`)</strong> atau <strong>localhost</strong>.
            </p>
            <p className="text-[11px] opacity-90">
              • <strong>Wajib HTTPS (SSL)</strong>: Jika di-deploy online (Hostinger/VPS), pastikan domain menggunakan <code>https://</code> (aktifkan SSL Let's Encrypt gratis di Hostinger).<br />
              • <strong>Dukungan Browser</strong>: Gunakan browser <strong>Google Chrome</strong> (Android/Desktop) atau <strong>Microsoft Edge</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Main Status & Management Card */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-500">
                <Printer className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  Pengaturan Bluetooth Printer
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Kelola koneksi printer thermal Bluetooth untuk mencetak struk transaksi otomatis
                </CardDescription>
              </div>
            </div>

            {/* Realtime Status Indicator Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Status Printer:</span>
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Hijau = Terhubung
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Merah = Tidak Terhubung
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 flex flex-col gap-6">
          {/* Error Message Alert Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-start justify-between gap-3 animate-zoom-in">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-xs font-semibold">
                  <span className="font-bold block text-sm mb-0.5">Peringatan Printer</span>
                  {errorMessage}
                </div>
              </div>
              <button
                onClick={clearError}
                className="text-xs font-bold hover:underline shrink-0"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Success Test Print Banner */}
          {testSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-3 animate-zoom-in">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span className="text-xs font-bold">
                Tes Cetak Berhasil! Data ESC/POS telah dikirim ke printer.
              </span>
            </div>
          )}

          {/* Connected Device Details Card */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl border ${isConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400'}`}>
                <Bluetooth className={`h-8 w-8 ${isConnecting ? 'animate-bounce' : ''}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Printer Terdaftar</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {deviceName || 'Belum Ada Printer Terhubung'}
                </span>
                {deviceId && (
                  <span className="text-xs text-slate-500 font-medium mt-1">
                    Device ID: <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">{deviceId}</code>
                  </span>
                )}
                {lastConnected && (
                  <span className="text-[11px] text-slate-400 mt-1">
                    Terakhir Terhubung: <strong>{lastConnected}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Action Badges */}
            <div className="flex items-center gap-2 self-end md:self-center">
              {isConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnectPrinter}
                  className="text-xs font-bold text-rose-500 border-rose-500/30 hover:bg-rose-500/10 flex items-center gap-1.5"
                >
                  <Unplug className="h-3.5 w-3.5" />
                  Putuskan Printer
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => autoReconnect()}
                  disabled={isConnecting || !deviceId}
                  className="text-xs font-bold text-blue-500 border-blue-500/30 hover:bg-blue-500/10 flex items-center gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                  Hubungkan Ulang
                </Button>
              )}
            </div>
          </div>

          {/* Grid Menu Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {/* 1. Hubungkan Printer */}
            <Button
              variant="primary"
              size="lg"
              onClick={connectPrinter}
              disabled={isConnecting || !isSupported}
              className="font-bold flex items-center justify-center gap-2 py-3 text-xs sm:text-sm"
            >
              <Bluetooth className="h-4 w-4 shrink-0" />
              <span>Hubungkan Printer</span>
            </Button>

            {/* 2. Cari Printer Bluetooth */}
            <Button
              variant="secondary"
              size="lg"
              onClick={connectPrinter}
              disabled={isConnecting || !isSupported}
              className="font-bold flex items-center justify-center gap-2 py-3 text-xs sm:text-sm"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span>Cari Printer Bluetooth</span>
            </Button>

            {/* 3. Tes Cetak */}
            <Button
              variant="outline"
              size="lg"
              onClick={handleTestPrint}
              disabled={!isConnected || isTesting}
              className="font-bold flex items-center justify-center gap-2 py-3 text-xs sm:text-sm border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>{isTesting ? 'Mencetak...' : 'Tes Cetak'}</span>
            </Button>
          </div>

          {/* Instructions & Troubleshooting Info */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex flex-col gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-blue-500" />
              Panduan Menghubungkan Bluetooth Thermal Printer:
            </span>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
              <li>Pastikan **Bluetooth HP/Perangkat** dan **Printer Thermal** sudah dinyalakan.</li>
              <li>Sistem akan meminta izin Bluetooth browser pertama kali Anda mengeklik **Hubungkan Printer**.</li>
              <li>Gunakan printer thermal Bluetooth standar 58mm atau 80mm yang mendukung perintah ESC/POS.</li>
              <li>Apabila koneksi terputus (printer mati / luar jangkauan), klik **Hubungkan Ulang** untuk mencoba terhubung kembali secara otomatis.</li>
              <li>Pengaturan printer disimpan secara lokal di perangkat ini sehingga saat transaksi selesai, struk otomatis tercetak.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
