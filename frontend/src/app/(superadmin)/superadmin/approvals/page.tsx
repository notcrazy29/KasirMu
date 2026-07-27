'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import { 
  ShieldCheck, 
  User, 
  Mail, 
  Calendar,
  CheckCircle,
  XCircle,
  ShieldAlert,
  Phone,
  MapPin,
  Store,
  Briefcase,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  
  // New profile fields
  fullName?: string | null;
  phone?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  address?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  postalCode?: string | null;

  // New store fields
  storeName?: string | null;
  businessType?: string | null;
  businessDescription?: string | null;
  storeLogo?: string | null;
  storeAddress?: string | null;
}

export default function SuperAdminApprovals() {
  const [pendingUsers, setPendingUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog States
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchPendingOwners = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // Query owners with status PENDING_APPROVAL
      const res = await api.get('/superadmin/users?role=OWNER&status=PENDING_APPROVAL');
      setPendingUsers(res.users || []);
    } catch (err) {
      console.error('Failed to load pending owners:', err);
      setErrorMsg('Gagal memuat daftar permintaan persetujuan.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingOwners();
  }, []);

  const handleApprove = async (userId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await api.patch('/admin/users/approve', { userId });
      setSuccessMsg('Akun owner berhasil disetujui & toko diaktifkan. Notifikasi email telah dikirim.');
      fetchPendingOwners();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyetujui akun');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRejectDialog = (user: UserItem) => {
    setSelectedUser(user);
    setRejectReason('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsRejectOpen(true);
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await api.patch('/admin/users/reject', { 
        userId: selectedUser.id,
        reason: rejectReason 
      });
      setSuccessMsg(`Pendaftaran ${selectedUser.name} berhasil ditolak.`);
      setIsRejectOpen(false);
      fetchPendingOwners();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menolak pendaftaran');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Helper to calculate age from birthDate string
  const calculateAge = (birthDateStr?: string | null) => {
    if (!birthDateStr) return null;
    const birth = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-500" />
          <span>Validasi Pendaftaran Owner</span>
          <span className="bg-amber-950 text-amber-400 text-xs px-2 py-0.5 rounded-full font-semibold border border-amber-500/10">
            {pendingUsers.length} Permintaan
          </span>
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Verifikasi berkas bisnis dan identitas owner sebelum memberikan akses operasional.</p>
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

      {/* Pending List */}
      {pendingUsers.length === 0 ? (
        <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/10 py-12 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-full text-slate-600">
              <ShieldCheck className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Tidak Ada Permintaan Baru</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">Semua pendaftaran owner saat ini telah disetujui penuh.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {pendingUsers.map((user) => (
            <Card key={user.id} className="border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/30 hover:border-slate-350 dark:hover:border-slate-800 transition-all flex flex-col">
              
              {/* Card Header (Basic owner user info) */}
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl border border-blue-500/10">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                        {user.fullName || user.name}
                        <span className="text-[10px] text-slate-400 font-normal bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                          ID: {user.id}
                        </span>
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5 text-slate-450" />
                          {user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5 text-slate-450" />
                            {user.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-450" />
                          Daftar: {formatDate(user.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <span className="bg-amber-950 text-amber-400 text-[10px] px-2.5 py-1 rounded font-black border border-amber-500/20 uppercase tracking-wider">
                    {user.status.replace('_', ' ')}
                  </span>
                </div>
              </CardHeader>
              
              {/* Card Body (Detailed Personal & Business profile data) */}
              <CardContent className="pt-5 flex flex-col gap-6">
                
                {/* Details Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  
                  {/* Column 1: Data Pribadi Detail */}
                  <div className="bg-slate-950/20 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-850 flex flex-col gap-3">
                    <h4 className="text-xs font-black text-blue-500 dark:text-blue-400 tracking-wider uppercase border-b border-slate-100 dark:border-slate-850 pb-1.5 flex items-center gap-1.5">
                      <User className="h-4 w-4" /> Detail Identitas Diri
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5">Nama Lengkap</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{user.fullName || user.name || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Jenis Kelamin</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {user.gender === 'MALE' ? 'Laki-laki' : user.gender === 'FEMALE' ? 'Perempuan' : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Tempat, Tgl Lahir</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {user.birthPlace || '-'}, {user.birthDate ? formatDate(user.birthDate) : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Umur</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {user.birthDate ? `${calculateAge(user.birthDate)} Tahun` : '-'}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs border-t border-slate-100 dark:border-slate-850 pt-2.5">
                      <span className="text-slate-400 block mb-0.5">Alamat KTP</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-start gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span>
                          {user.address || '-'}, Kec. {user.district || '-'}, {user.city || '-'}, {user.province || '-'} ({user.postalCode || '-'})
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Column 2: Data Usaha Detail */}
                  <div className="bg-slate-950/20 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-850 flex flex-col gap-3">
                    <h4 className="text-xs font-black text-blue-500 dark:text-blue-400 tracking-wider uppercase border-b border-slate-100 dark:border-slate-850 pb-1.5 flex items-center gap-1.5">
                      <Store className="h-4 w-4" /> Informasi Toko / Usaha
                    </h4>
                    
                    <div className="flex gap-4">
                      {/* Logo Preview */}
                      <div className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                        {user.storeLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.storeLogo} alt="Store Logo" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-slate-655" />
                        )}
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{user.storeName || '-'}</h5>
                          <span className="bg-blue-950 text-blue-400 text-[9px] px-2 py-0.5 rounded-full font-bold border border-blue-500/10 flex items-center gap-1">
                            <Briefcase className="h-2.5 w-2.5" />
                            {user.businessType || 'UMKM'}
                          </span>
                        </div>
                        {user.businessDescription && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {user.businessDescription}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-xs border-t border-slate-100 dark:border-slate-850 pt-2.5 flex flex-col gap-1">
                      <div>
                        <span className="text-slate-400 inline-block w-20">Alamat Usaha:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{user.storeAddress || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 inline-block w-20">Jam Buka/Tutup:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">Setiap Hari (08:00 - 22:00)</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Card Actions Footer */}
                <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 dark:border-slate-850">
                  <Button
                    onClick={() => openRejectDialog(user)}
                    variant="outline"
                    className="text-red-500 border-red-200 dark:border-red-950 dark:hover:bg-red-950/20 font-bold text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
                    disabled={isSubmitting}
                  >
                    <XCircle className="h-4 w-4" />
                    Tolak Pendaftaran
                  </Button>
                  <Button
                    onClick={() => handleApprove(user.id)}
                    variant="primary"
                    className="bg-emerald-600! hover:bg-emerald-700! text-white font-bold text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer shadow-[0_4px_10px_rgba(16,185,129,0.15)] border-none"
                    disabled={isSubmitting}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Setujui Akun & Toko
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <Dialog
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        title="Tolak Pendaftaran Owner"
      >
        <form onSubmit={handleReject} className="flex flex-col gap-4">
          <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed flex items-start gap-1.5 bg-red-950/10 border border-red-500/10 p-3 rounded-xl">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <span>
              Berikan alasan penolakan untuk dikirimkan secara otomatis ke alamat email pendaftar <strong>({selectedUser?.email})</strong>.
            </span>
          </p>

          <Input
            id="rejectReason"
            type="text"
            label="Alasan Penolakan Resmi"
            placeholder="Contoh: Lampiran logo toko tidak valid / berkas identitas buram."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            required
          />

          <div className="flex gap-3 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRejectOpen(false)}
              disabled={isSubmitting}
              className="cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="bg-red-600! hover:bg-red-700! text-white font-bold cursor-pointer"
              isLoading={isSubmitting}
            >
              Kirim Email Penolakan
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
