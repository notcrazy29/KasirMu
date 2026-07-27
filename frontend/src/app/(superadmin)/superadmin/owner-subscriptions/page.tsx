'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Card, { CardContent, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import {
  Sparkles,
  Search,
  Users,
  Building2,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Edit3,
  XCircle,
  Info,
  RefreshCw,
  Crown,
} from 'lucide-react';

// ──────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────

interface OwnerRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  storeName: string;
  currentPlan: string;
  status: string;
  isPremium: boolean;
  isLifetime: boolean;
  expiredDate: string | null;
  source: string;
  reason: string | null;
}

type DurationType = '1_MONTH' | '3_MONTHS' | '6_MONTHS' | '12_MONTHS' | 'LIFETIME';

const REASON_PRESETS = [
  'Bonus Launching',
  'Kompensasi Bug',
  'Customer VIP',
  'Partner Resmi',
  'Testing Internal',
  'Hadiah Event',
];

export default function OwnerSubscriptionsPage() {
  const [owners, setOwners] = useState<OwnerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'ALL' | 'PREMIUM' | 'FREE'>('ALL');

  // Modal State
  const [selectedOwner, setSelectedOwner] = useState<OwnerRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmRevokeOpen, setIsConfirmRevokeOpen] = useState(false);

  // Form State
  const [selectedPlan, setSelectedPlan] = useState<'PREMIUM' | 'FREE'>('PREMIUM');
  const [selectedDuration, setSelectedDuration] = useState<DurationType>('1_MONTH');
  const [reasonInput, setReasonInput] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Alert State
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchOwners = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/superadmin/owner-subscriptions');
      setOwners(res.owners || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat daftar owner.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOwners();
  }, []);

  const handleOpenModal = (owner: OwnerRecord) => {
    setSelectedOwner(owner);
    setSelectedPlan(owner.isPremium ? 'PREMIUM' : 'PREMIUM');
    setSelectedDuration(owner.isLifetime ? 'LIFETIME' : '1_MONTH');
    setReasonInput('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwner) return;

    if (!reasonInput.trim()) {
      setFormError('Alasan wajib diisi untuk keamanan & audit log.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      const payload = {
        ownerId: selectedOwner.id,
        planName: selectedPlan,
        duration: selectedDuration,
        reason: reasonInput.trim(),
      };

      const res = await api.post('/superadmin/owner-subscriptions/grant', payload);

      setSuccessMsg(res.message || 'Berhasil mengaktifkan langganan manual!');
      setIsModalOpen(false);
      await fetchOwners();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Gagal memproses override langganan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!selectedOwner) return;

    setIsSubmitting(true);
    setFormError('');
    try {
      const res = await api.post('/superadmin/owner-subscriptions/revoke', {
        ownerId: selectedOwner.id,
        reason: reasonInput.trim() || 'Dicabut oleh Super Admin',
      });

      setSuccessMsg(res.message || 'Berhasil mencabut status Premium owner!');
      setIsConfirmRevokeOpen(false);
      setIsModalOpen(false);
      await fetchOwners();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Gagal mencabut status Premium.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered list
  const filteredOwners = owners.filter((o) => {
    const matchesSearch =
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.phone.includes(searchQuery);

    if (planFilter === 'PREMIUM') return matchesSearch && o.isPremium;
    if (planFilter === 'FREE') return matchesSearch && !o.isPremium;
    return matchesSearch;
  });

  const formatDate = (dateStr: string | null, isLifetime: boolean) => {
    if (isLifetime) return '∞ Tanpa Batas Waktu';
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" />
            Kelola Langganan Owner (Manual Override)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Fitur khusus Super Admin untuk memberikan, memodifikasi, atau mencabut paket Premium akun Owner secara manual tanpa jalur pembayaran Midtrans.
          </p>
        </div>

        <button
          onClick={fetchOwners}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors w-fit cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-3 animate-fadeIn">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Nama Owner, Email, No. HP, atau Toko..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Plan Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setPlanFilter('ALL')}
              className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                planFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semua ({owners.length})
            </button>
            <button
              onClick={() => setPlanFilter('PREMIUM')}
              className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                planFilter === 'PREMIUM'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-amber-500 hover:bg-amber-500/10'
              }`}
            >
              Premium ({owners.filter((o) => o.isPremium).length})
            </button>
            <button
              onClick={() => setPlanFilter('FREE')}
              className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                planFilter === 'FREE'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Free ({owners.filter((o) => !o.isPremium).length})
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Owners Table */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin h-8 w-8 rounded-full border-t-2 border-amber-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                    <th className="px-5 py-3.5 font-black text-slate-500 uppercase tracking-wider text-[10px]">Nama Owner</th>
                    <th className="px-5 py-3.5 font-black text-slate-500 uppercase tracking-wider text-[10px]">Email</th>
                    <th className="px-5 py-3.5 font-black text-slate-500 uppercase tracking-wider text-[10px]">Nomor HP</th>
                    <th className="px-5 py-3.5 font-black text-slate-500 uppercase tracking-wider text-[10px]">Nama Toko</th>
                    <th className="px-5 py-3.5 font-black text-slate-500 uppercase tracking-wider text-[10px]">Paket Saat Ini</th>
                    <th className="px-5 py-3.5 font-black text-slate-500 uppercase tracking-wider text-[10px]">Status</th>
                    <th className="px-5 py-3.5 font-black text-slate-500 uppercase tracking-wider text-[10px]">Premium Sampai</th>
                    <th className="px-5 py-3.5 font-black text-slate-500 uppercase tracking-wider text-[10px] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {filteredOwners.map((owner) => (
                    <tr
                      key={owner.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Nama Owner */}
                      <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-black text-slate-600 dark:text-slate-300 text-xs">
                            {owner.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{owner.name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-medium">
                        {owner.email}
                      </td>

                      {/* Nomor HP */}
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        {owner.phone}
                      </td>

                      {/* Nama Toko */}
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{owner.storeName}</span>
                        </div>
                      </td>

                      {/* Paket Saat Ini */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            owner.isPremium
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {owner.isPremium && <Crown className="h-3 w-3" />}
                          {owner.currentPlan}
                        </span>
                        {owner.source === 'MANUAL_GRANT' && (
                          <span className="block text-[9px] font-bold text-blue-500 mt-0.5">
                            (Manual Grant)
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            owner.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : owner.status === 'GRACE_PERIOD'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-red-500/10 text-red-500'
                          }`}
                        >
                          {owner.status}
                        </span>
                      </td>

                      {/* Premium Sampai */}
                      <td className="px-5 py-4 font-medium text-slate-700 dark:text-slate-300">
                        {formatDate(owner.expiredDate, owner.isLifetime)}
                      </td>

                      {/* Tombol Kelola */}
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleOpenModal(owner)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Kelola
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredOwners.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">
                        Tidak ada akun owner yang ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────── */}
      {/* Modal Popup: Kelola Langganan Owner */}
      {/* ────────────────────────────────────────────────── */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Kelola Langganan Owner"
        description="Berikan atau ubah status langganan akun owner tanpa melalui pembayaran Midtrans."
      >
        {selectedOwner && (
          <form onSubmit={handleSaveGrant} className="flex flex-col gap-5 pt-2">
            {/* Header Card Summary */}
            <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedOwner.name}
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    selectedOwner.isPremium
                      ? 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {selectedOwner.currentPlan}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
                <span>Email: {selectedOwner.email}</span>
                <span>Toko: {selectedOwner.storeName}</span>
                <span>
                  Status Expired Saat Ini:{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {formatDate(selectedOwner.expiredDate, selectedOwner.isLifetime)}
                  </strong>
                </span>
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Pilih Paket (Dropdown) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Pilih Paket *
              </label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value as 'PREMIUM' | 'FREE')}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PREMIUM">PREMIUM (Akses Semua Fitur Premium)</option>
                <option value="FREE">FREE (Paket Gratis Standar)</option>
              </select>
            </div>

            {/* Jenis Aktivasi (Radio Buttons - only if PREMIUM) */}
            {selectedPlan === 'PREMIUM' && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Jenis Aktivasi / Durasi *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: '1_MONTH', label: 'Premium 1 Bulan', desc: '+30 hari dari sekarang' },
                    { id: '3_MONTHS', label: 'Premium 3 Bulan', desc: '+90 hari dari sekarang' },
                    { id: '6_MONTHS', label: 'Premium 6 Bulan', desc: '+180 hari dari sekarang' },
                    { id: '12_MONTHS', label: 'Premium 12 Bulan', desc: '+365 hari dari sekarang' },
                    { id: 'LIFETIME', label: 'Premium Tanpa Batas Waktu', desc: 'Lifetime Access (Tidak Expire)' },
                  ].map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedDuration === item.id
                          ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-white shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="duration"
                        value={item.id}
                        checked={selectedDuration === item.id}
                        onChange={() => setSelectedDuration(item.id as DurationType)}
                        className="mt-0.5 accent-amber-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {item.desc}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Alasan (Textarea Wajib) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Alasan Pemberian / Perubahan *
                </label>
                <span className="text-[10px] text-red-500 font-bold">Wajib diisi</span>
              </div>
              <textarea
                rows={3}
                placeholder="Contoh: Bonus Launching, Kompensasi Bug, Customer VIP, Partner Resmi, Testing Internal, Hadiah Event..."
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                required
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                {REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReasonInput(preset)}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-amber-500 hover:text-white text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Tombol Action */}
            <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              {/* Cabut Premium Button (Only if owner has Premium) */}
              {selectedOwner.isPremium ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmRevokeOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle className="h-4 w-4" />
                  Cabut Premium
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
                >
                  Aktifkan Premium
                </Button>
              </div>
            </div>
          </form>
        )}
      </Dialog>

      {/* ────────────────────────────────────────────────── */}
      {/* Modal Confirmation: Cabut Premium */}
      {/* ────────────────────────────────────────────────── */}
      <Dialog
        isOpen={isConfirmRevokeOpen}
        onClose={() => setIsConfirmRevokeOpen(false)}
        title="Konfirmasi Pencabutan Premium"
        description="Apakah Anda yakin ingin mencabut status Premium owner ini?"
      >
        <div className="flex flex-col gap-4 pt-2">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
            <div>
              <p className="font-bold text-red-500">Peringatan Pencabutan Hak Akses!</p>
              <p className="mt-1">
                Tindakan ini akan mengembalikan akun <strong>{selectedOwner?.name}</strong> ke paket <strong>FREE</strong>. Fitur premium seperti Midtrans, QRIS, Analitik, dan produk unlimited akan langsung dinonaktifkan di dashboard owner secara realtime.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmRevokeOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={isSubmitting}
              onClick={handleConfirmRevoke}
            >
              Ya, Cabut Premium
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
