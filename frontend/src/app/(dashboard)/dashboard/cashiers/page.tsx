'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import Card, { CardContent } from '@/components/ui/Card';
import Table, { TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Dialog from '@/components/ui/Dialog';
import Badge from '@/components/ui/Badge';
import { 
  Plus, 
  UserPlus, 
  User, 
  Lock, 
  ShieldCheck,
  Calendar,
  Edit2,
  Trash2,
  Clock,
  Filter,
  AlertCircle,
  TrendingUp
} from 'lucide-react';

interface Cashier {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface Shift {
  id: string;
  userId: string;
  storeId: string;
  startTime: string;
  endTime: string | null;
  startingCash: string | number;
  endingCash: string | number | null;
  totalSales: string | number;
  status: 'OPEN' | 'CLOSED';
  user: {
    name: string;
    email: string;
  };
}

export default function CashiersPage() {
  const { currentStoreId } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'cashiers' | 'shifts'>('cashiers');
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  
  const [isLoadingCashiers, setIsLoadingCashiers] = useState(true);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  
  // Modals status
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isForceCloseModalOpen, setIsForceCloseModalOpen] = useState(false);

  // Add Cashier Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Edit Cashier Form fields
  const [selectedCashier, setSelectedCashier] = useState<Cashier | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');

  // Force Close Shift Form fields
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [endingCash, setEndingCash] = useState('');
  const [closeError, setCloseError] = useState('');

  // Filters
  const [filterCashierId, setFilterCashierId] = useState('');

  const fetchCashiers = async () => {
    if (!currentStoreId) return;
    setIsLoadingCashiers(true);
    try {
      const response = await api.get(`/cashiers?storeId=${currentStoreId}`);
      setCashiers(response.cashiers);
    } catch (err) {
      console.error('Failed to load cashiers list:', err);
    } finally {
      setIsLoadingCashiers(false);
    }
  };

  const fetchShifts = async () => {
    if (!currentStoreId) return;
    setIsLoadingShifts(true);
    try {
      const url = filterCashierId 
        ? `/transactions/shifts?storeId=${currentStoreId}&userId=${filterCashierId}`
        : `/transactions/shifts?storeId=${currentStoreId}`;
      const response = await api.get(url);
      setShifts(response.shifts || []);
    } catch (err) {
      console.error('Failed to load shifts list:', err);
    } finally {
      setIsLoadingShifts(false);
    }
  };

  useEffect(() => {
    fetchCashiers();
  }, [currentStoreId]);

  useEffect(() => {
    if (activeTab === 'shifts') {
      fetchShifts();
    }
  }, [currentStoreId, activeTab, filterCashierId]);

  const handleAddCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !currentStoreId) return;

    setError('');
    try {
      await api.post('/cashiers', {
        name,
        email,
        password,
        storeId: currentStoreId,
      });

      setIsAddModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      fetchCashiers();
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan akun kasir');
    }
  };

  const openEditModal = (cashier: Cashier) => {
    setSelectedCashier(cashier);
    setEditName(cashier.name);
    setEditEmail(cashier.email);
    setEditPassword('');
    setEditError('');
    setIsEditModalOpen(true);
  };

  const handleEditCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCashier || !editName || !editEmail) return;

    setEditError('');
    try {
      await api.put(`/cashiers/${selectedCashier.id}`, {
        name: editName,
        email: editEmail,
        password: editPassword || undefined,
      });

      setIsEditModalOpen(false);
      setSelectedCashier(null);
      setEditName('');
      setEditEmail('');
      setEditPassword('');
      fetchCashiers();
    } catch (err: any) {
      setEditError(err.message || 'Gagal mengubah data kasir');
    }
  };

  const handleDeleteCashier = async (cashier: Cashier) => {
    const confirmation = window.confirm(
      `Apakah Anda yakin ingin menghapus kasir "${cashier.name}"?\n\nJika kasir sudah memiliki riwayat transaksi/shift, akun akan dinonaktifkan (disembunyikan) secara aman.`
    );
    if (!confirmation) return;

    try {
      await api.delete(`/cashiers/${cashier.id}`);
      fetchCashiers();
      if (activeTab === 'shifts') {
        fetchShifts();
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus kasir');
    }
  };

  const openForceCloseModal = (shift: Shift) => {
    setSelectedShift(shift);
    const expected = Number(shift.startingCash) + Number(shift.totalSales);
    setEndingCash(expected.toString());
    setCloseError('');
    setIsForceCloseModalOpen(true);
  };

  const handleForceCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShift || endingCash === '') return;

    setCloseError('');
    try {
      await api.post(`/transactions/shifts/${selectedShift.id}/force-end`, {
        endingCash: Number(endingCash),
      });

      setIsForceCloseModalOpen(false);
      setSelectedShift(null);
      setEndingCash('');
      fetchShifts();
    } catch (err: any) {
      setCloseError(err.message || 'Gagal menutup paksa shift');
    }
  };

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Manajemen Staf Kasir</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Daftarkan kasir baru dan pantau jam kerja/shift operasional secara realtime</p>
        </div>
        
        {activeTab === 'cashiers' && (
          <Button
            variant="primary"
            className="font-bold flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
            onClick={() => {
              setError('');
              setIsAddModalOpen(true);
            }}
          >
            <UserPlus className="h-4.5 w-4.5" />
            <span>Tambah Kasir</span>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'cashiers'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('cashiers')}
        >
          Daftar Kasir
        </button>
        <button
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'shifts'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('shifts')}
        >
          Riwayat Shift Kerja
        </button>
      </div>

      {/* Tab 1: Cashiers List */}
      {activeTab === 'cashiers' && (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10">
          <CardContent className="p-0">
            {isLoadingCashiers ? (
              <div className="flex justify-center py-12">
                <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : cashiers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Kasir</TableHead>
                    <TableHead>ID Login</TableHead>
                    <TableHead>Terdaftar Sejak</TableHead>
                    <TableHead className="text-center w-24">Peran</TableHead>
                    <TableHead className="text-right pr-6 w-28">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashiers.map((cashier) => (
                    <TableRow key={cashier.id}>
                      <TableCell className="font-bold text-slate-900 dark:text-white text-xs">
                        {cashier.name}
                      </TableCell>
                      
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                        {cashier.email}
                      </TableCell>

                      <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          <span>{new Date(cashier.createdAt).toLocaleDateString('id-ID')}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <span className="text-[10px] uppercase font-bold text-blue-500 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                          Cashier
                        </span>
                      </TableCell>

                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(cashier)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-500 rounded transition-colors cursor-pointer"
                            title="Edit Data"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCashier(cashier)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-red-500 rounded transition-colors cursor-pointer"
                            title="Hapus Kasir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                Belum ada akun kasir terdaftar di toko ini.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Shift History */}
      {activeTab === 'shifts' && (
        <div className="flex flex-col gap-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-850">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Filter className="h-4 w-4 text-blue-500" />
              <span>Filter Kasir:</span>
            </div>
            <select
              value={filterCashierId}
              onChange={(e) => setFilterCashierId(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-xs px-3 py-1.5 font-medium outline-none focus:border-blue-500/50"
            >
              <option value="">Semua Kasir</option>
              {cashiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </div>

          {/* Shifts Table */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10">
            <CardContent className="p-0">
              {isLoadingShifts ? (
                <div className="flex justify-center py-12">
                  <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : shifts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Kasir</TableHead>
                      <TableHead>Mulai (Awal Kerja)</TableHead>
                      <TableHead>Selesai (Akhir Kerja)</TableHead>
                      <TableHead className="text-right">Kas Awal</TableHead>
                      <TableHead className="text-right">Total Penjualan</TableHead>
                      <TableHead className="text-right">Kas Akhir</TableHead>
                      <TableHead className="text-center w-24">Status</TableHead>
                      <TableHead className="text-right pr-6 w-32">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((shift) => {
                      const expectedEndingCash = Number(shift.startingCash) + Number(shift.totalSales);
                      const isShiftOpen = shift.status === 'OPEN';
                      return (
                        <TableRow key={shift.id}>
                          <TableCell className="font-bold text-slate-900 dark:text-white text-xs">
                            {shift.user?.name || 'Kasir Tidak Dikenal'}
                          </TableCell>
                          
                          <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-blue-500" />
                              <span>{formatDateTime(shift.startTime)}</span>
                            </div>
                          </TableCell>

                          <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                            {shift.endTime ? (
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                <span>{formatDateTime(shift.endTime)}</span>
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-emerald-500 animate-pulse bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Sedang Bekerja (Aktif)
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-right text-slate-700 dark:text-slate-300 font-mono">
                            {formatCurrency(shift.startingCash)}
                          </TableCell>

                          <TableCell className="text-xs text-right text-slate-700 dark:text-slate-300 font-mono">
                            {formatCurrency(shift.totalSales)}
                          </TableCell>

                          <TableCell className="text-xs text-right text-slate-700 dark:text-slate-300 font-mono">
                            {isShiftOpen ? (
                              <span className="text-[11px] text-slate-400 italic">Ekspektasi: {formatCurrency(expectedEndingCash)}</span>
                            ) : (
                              <span className="font-bold text-slate-900 dark:text-white">
                                {formatCurrency(shift.endingCash || 0)}
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="text-center">
                            <Badge variant={isShiftOpen ? 'success' : 'secondary'}>
                              {shift.status}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right pr-6">
                            {isShiftOpen ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="text-[11px] font-bold py-1 px-2.5 cursor-pointer"
                                onClick={() => openForceCloseModal(shift)}
                              >
                                Paksa Tutup
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Tidak ditemukan riwayat shift kerja di toko ini.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Cashier Dialog Modal */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Daftarkan Akun Kasir Baru"
        description="Buat akun untuk petugas kasir agar dapat masuk ke menu POS"
      >
        <form onSubmit={handleAddCashier} className="flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          <Input
            id="cName"
            type="text"
            label="Nama Lengkap Staf"
            placeholder="Siti Rahma"
            value={name}
            onChange={(e) => setName(e.target.value)}
            leftIcon={<User className="h-4 w-4" />}
            required
          />

          <Input
            id="cEmail"
            type="text"
            label="ID Login / Username"
            placeholder="Contoh: amelia atau kasir01"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<User className="h-4 w-4" />}
            required
          />

          <Input
            id="cPassword"
            type="password"
            label="Kata Sandi Awal"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="h-4 w-4" />}
            required
          />

          <div className="flex gap-2.5 items-start bg-slate-900 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
            <span>
              Akun kasir ini akan secara otomatis terikat dengan Toko aktif saat ini. Kasir tidak memiliki akses ke pengaturan dashboard owner.
            </span>
          </div>

          <div className="flex gap-3 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="font-bold cursor-pointer"
              disabled={!name || !email || !password}
            >
              Daftar Kasir
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Cashier Dialog Modal */}
      <Dialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Ubah Data Akun Kasir"
        description="Perbarui informasi profil atau ganti kata sandi akun petugas kasir"
      >
        <form onSubmit={handleEditCashier} className="flex flex-col gap-4">
          {editError && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold">
              {editError}
            </div>
          )}

          <Input
            id="editName"
            type="text"
            label="Nama Lengkap Staf"
            placeholder="Siti Rahma"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            leftIcon={<User className="h-4 w-4" />}
            required
          />

          <Input
            id="editEmail"
            type="text"
            label="ID Login / Username"
            placeholder="Contoh: amelia atau kasir01"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            leftIcon={<User className="h-4 w-4" />}
            required
          />

          <Input
            id="editPassword"
            type="password"
            label="Kata Sandi Baru (Kosongkan jika tidak ingin diubah)"
            placeholder="••••••••"
            value={editPassword}
            onChange={(e) => setEditPassword(e.target.value)}
            leftIcon={<Lock className="h-4 w-4" />}
          />

          <div className="flex gap-2.5 items-start bg-slate-900 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
            <span>
              Perubahan username akan memengaruhi kredensial login kasir bersangkutan secara instan.
            </span>
          </div>

          <div className="flex gap-3 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="font-bold cursor-pointer"
              disabled={!editName || !editEmail}
            >
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Force Close Shift Dialog Modal */}
      <Dialog
        isOpen={isForceCloseModalOpen}
        onClose={() => setIsForceCloseModalOpen(false)}
        title="Paksa Tutup Shift Kasir"
        description="Tutup paksa laci kasir dan kunci transaksi aktif petugas kasir"
      >
        {selectedShift && (
          <form onSubmit={handleForceCloseShift} className="flex flex-col gap-4">
            {closeError && (
              <div className="p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold">
                {closeError}
              </div>
            )}

            {/* Shift Summary Cards */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-semibold">Kasir Aktif:</span>
                <span className="text-white font-bold text-sm">{selectedShift.user?.name}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-semibold">Mulai Shift:</span>
                <span className="text-white font-mono">{formatDateTime(selectedShift.startTime)}</span>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-slate-400 font-semibold">Uang Modal Awal:</span>
                <span className="text-white font-bold font-mono">{formatCurrency(selectedShift.startingCash)}</span>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-slate-400 font-semibold flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  Total Penjualan:
                </span>
                <span className="text-emerald-400 font-bold font-mono">{formatCurrency(selectedShift.totalSales)}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-900/20 border border-amber-500/30 text-amber-300 rounded-lg text-[11px] flex gap-2 items-start leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                <strong>Perhatian:</strong> Menutup shift dari dashboard owner akan langsung mengunci terminal kasir yang bersangkutan. Kasir harus membuka shift baru kembali untuk dapat bertransaksi.
              </span>
            </div>

            <Input
              id="endingCash"
              type="number"
              label="Uang Kas Akhir di Laci (Berdasarkan audit fisik)"
              placeholder="Contoh: 350000"
              value={endingCash}
              onChange={(e) => setEndingCash(e.target.value)}
              required
              className="font-mono text-base"
            />

            <div className="flex gap-3 justify-end mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsForceCloseModalOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="font-bold cursor-pointer"
                disabled={endingCash === ''}
              >
                Paksa Tutup Shift
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
