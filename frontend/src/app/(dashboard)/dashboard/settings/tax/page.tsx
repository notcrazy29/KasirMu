'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../../../../store/useAuthStore';
import { api } from '../../../../../lib/api';
import Card, { CardContent, CardHeader, CardTitle } from '../../../../../components/ui/Card';
import Button from '../../../../../components/ui/Button';
import Input from '../../../../../components/ui/Input';
import { Settings, ShieldAlert, BadgeInfo, CheckCircle2 } from 'lucide-react';

interface TaxSetting {
  id?: string;
  storeId: string;
  taxName: string;
  percentage: number;
  calculationType: 'INCLUSIVE' | 'EXCLUSIVE';
  isActive: boolean;
  createdBy: string;
  updatedAt: string;
}

export default function TaxSettingsPage() {
  const { user, currentStoreId } = useAuthStore();
  const [taxSetting, setTaxSetting] = useState<TaxSetting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [taxName, setTaxName] = useState('PPN');
  const [percentage, setPercentage] = useState<number>(10);
  const [calculationType, setCalculationType] = useState<'INCLUSIVE' | 'EXCLUSIVE'>('EXCLUSIVE');
  const [isActive, setIsActive] = useState(true);

  const fetchTaxSetting = async () => {
    if (!currentStoreId) return;
    setIsLoading(true);
    try {
      const response = await api.get('/tax');
      if (response.taxSetting) {
        setTaxSetting(response.taxSetting);
        // Populate form
        setTaxName(response.taxSetting.taxName);
        setPercentage(Number(response.taxSetting.percentage));
        setCalculationType(response.taxSetting.calculationType);
        setIsActive(response.taxSetting.isActive);
      }
    } catch (err) {
      console.error('Failed to load tax setting:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxSetting();
  }, [currentStoreId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== 'OWNER') {
      setMessage({ type: 'error', text: 'Hanya OWNER yang dapat mengubah konfigurasi pajak.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await api.post('/tax', {
        taxName,
        percentage: Number(percentage),
        isActive,
        calculationType,
      });

      setTaxSetting(response.taxSetting);
      setMessage({ type: 'success', text: 'Pengaturan pajak berhasil disimpan!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan pengaturan pajak.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (taxSetting) {
      setTaxName(taxSetting.taxName);
      setPercentage(Number(taxSetting.percentage));
      setCalculationType(taxSetting.calculationType);
      setIsActive(taxSetting.isActive);
    } else {
      setTaxName('PPN');
      setPercentage(10);
      setCalculationType('EXCLUSIVE');
      setIsActive(true);
    }
    setMessage(null);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        <svg className="animate-spin h-6 w-6 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Memuat pengaturan pajak...</span>
      </div>
    );
  }

  if (user?.role === 'CASHIER') {
    return (
      <div className="flex-1 p-6 md:p-8 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <div className="bg-red-500/10 p-4 rounded-full text-red-500 mb-4 animate-bounce">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Akses Ditolak</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Kasir tidak memiliki izin untuk mengonfigurasi pengaturan pajak toko. Silakan hubungi pemilik outlet (Owner).
        </p>
      </div>
    );
  }

  const isReadOnly = user?.role === 'SUPER_ADMIN';

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-blue-500" />
          Pengaturan Pajak Toko
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5">
          Atur persentase pajak dan metode perhitungan yang akan otomatis diterapkan pada saat kasir melakukan transaksi.
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
            : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <ShieldAlert className="h-5 w-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {isReadOnly && (
        <div className="bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 p-4 rounded-xl flex gap-3 text-xs">
          <BadgeInfo className="h-5 w-5 shrink-0" />
          <div>
            <span className="font-bold block">Mode Peninjauan (Super Admin)</span>
            <span className="mt-0.5 block">Anda hanya dapat melihat konfigurasi pajak ini untuk keperluan audit/bantuan teknis. Modifikasi formulir dinonaktifkan.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ubah Konfigurasi Pajak</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <Input
                  id="taxName"
                  label="Nama Pajak"
                  value={taxName}
                  onChange={(e) => setTaxName(e.target.value)}
                  placeholder="Contoh: PPN, Pajak Restoran, Service Charge..."
                  required
                  disabled={isReadOnly || isSaving}
                />

                <Input
                  id="percentage"
                  label="Persentase Pajak (%)"
                  type="number"
                  step="0.01"
                  value={percentage}
                  onChange={(e) => setPercentage(Number(e.target.value))}
                  placeholder="Contoh: 10, 11, 5..."
                  required
                  disabled={isReadOnly || isSaving}
                />

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Metode Perhitungan</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={isReadOnly || isSaving}
                      onClick={() => setCalculationType('EXCLUSIVE')}
                      className={`p-3 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                        calculationType === 'EXCLUSIVE'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-normal uppercase mb-0.5">Tax Exclusive</span>
                      <span>Tambahan Pajak (Exclusive)</span>
                    </button>
                    <button
                      type="button"
                      disabled={isReadOnly || isSaving}
                      onClick={() => setCalculationType('INCLUSIVE')}
                      className={`p-3 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                        calculationType === 'INCLUSIVE'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-normal uppercase mb-0.5">Tax Inclusive</span>
                      <span>Termasuk Pajak (Inclusive)</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status Pajak</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={isReadOnly || isSaving}
                      onClick={() => setIsActive(true)}
                      className={`p-3 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>Aktif</span>
                    </button>
                    <button
                      type="button"
                      disabled={isReadOnly || isSaving}
                      onClick={() => setIsActive(false)}
                      className={`p-3 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                        !isActive
                          ? 'border-red-500 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-extrabold'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>Tidak Aktif</span>
                    </button>
                  </div>
                </div>

                {!isReadOnly && (
                  <div className="flex gap-3 justify-end border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handleReset}
                      disabled={isSaving}
                    >
                      Reset
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      isLoading={isSaving}
                    >
                      Simpan Pengaturan
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Info / Audit Column */}
        <div>
          <Card className="text-xs">
            <CardHeader>
              <CardTitle>Ringkasan Aktif</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Nama Pajak</span>
                <span className="text-slate-900 dark:text-white font-bold block text-sm mt-0.5">{taxSetting?.taxName || 'PPN (Default)'}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Persentase</span>
                <span className="text-slate-900 dark:text-white font-bold block text-sm mt-0.5">{taxSetting?.percentage !== undefined ? `${taxSetting.percentage}%` : '0%'}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Metode Perhitungan</span>
                <span className="text-slate-900 dark:text-white font-bold block mt-0.5">
                  {taxSetting?.calculationType === 'INCLUSIVE' ? 'Tax Inclusive (Sudah Termasuk)' : 'Tax Exclusive (Tambahan)'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Status</span>
                <span className="block mt-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    taxSetting?.isActive 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                      : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20'
                  }`}>
                    {taxSetting?.isActive ? 'AKTIF' : 'TIDAK AKTIF'}
                  </span>
                </span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 mt-1 flex flex-col gap-2">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Diubah Oleh</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium block mt-0.5">{taxSetting?.createdBy || 'System / Default'}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Terakhir Diubah</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium block mt-0.5">
                    {taxSetting?.updatedAt ? new Date(taxSetting.updatedAt).toLocaleString('id-ID') : '-'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
