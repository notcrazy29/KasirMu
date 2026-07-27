'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Wrench, CheckCircle, ShieldAlert } from 'lucide-react';

export default function SuperAdminMaintenance() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchMaintenanceSettings = async () => {
      try {
        const res = await api.get('/superadmin/maintenance');
        setMaintenanceMode(res.maintenanceMode);
        setMessage(res.message || '');
      } catch (err) {
        console.error('Failed to load maintenance settings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMaintenanceSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.post('/superadmin/maintenance', {
        enabled: maintenanceMode,
        message
      });
      setSuccessMsg(`Mode pemeliharaan sistem berhasil diperbarui menjadi: ${maintenanceMode ? 'AKTIF' : 'NON-AKTIF'}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengubah status pemeliharaan');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Wrench className="h-6 w-6 text-blue-500" />
          <span>Pemeliharaan Sistem (Maintenance)</span>
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Kendalikan status online platform. Mode pemeliharaan memblokir kasir & owner tetapi membiarkan admin tetap masuk.</p>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-950 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-950 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Control Card */}
      <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/40">
        <CardHeader>
          <CardTitle className="text-sm font-extrabold text-slate-900 dark:text-white">Status Online KasirMu</CardTitle>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400">Toggle mode pemeliharaan dan atur pesan pengumuman layar kunci.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* Toggle Status switch */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-850 rounded-xl">
              <div>
                <span className="block font-bold text-slate-900 dark:text-white text-xs">Aktifkan Mode Maintenance</span>
                <span className="block text-[10px] text-slate-550 dark:text-slate-400 mt-0.5">
                  {maintenanceMode 
                    ? 'Sistem sedang memblokir akses publik. Hanya Super Admin yang dapat mengakses API.' 
                    : 'Sistem berjalan normal. Seluruh owner dan kasir dapat menggunakan sistem.'}
                </span>
              </div>
              
              <button
                type="button"
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  maintenanceMode ? 'bg-blue-600' : 'bg-slate-350 dark:bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    maintenanceMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Announcement Message */}
            <div className="flex flex-col gap-2">
              <label htmlFor="maintMessage" className="text-xs font-bold text-slate-600 dark:text-slate-450">
                Pesan Pengumuman Pemeliharaan
              </label>
              <textarea
                id="maintMessage"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contoh: Sistem sedang melakukan pemeliharaan server berkala. Silakan coba login beberapa saat lagi."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none leading-relaxed"
                required={maintenanceMode}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-900">
              <Button
                type="submit"
                variant="primary"
                className="font-bold text-xs px-4 py-2 cursor-pointer"
                isLoading={isSubmitting}
              >
                Simpan Konfigurasi
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
