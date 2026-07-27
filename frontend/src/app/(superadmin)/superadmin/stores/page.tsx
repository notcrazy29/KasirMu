'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit3, 
  Key, 
  Phone, 
  MapPin,
  ExternalLink
} from 'lucide-react';

interface Owner {
  id: string;
  name: string;
  email: string;
}

interface Store {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo: string | null;
  pairingCode: string;
  ownerId: string;
  owner: Owner;
  _count: {
    branches: number;
    products: number;
    cashiers: number;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function SuperAdminStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [owners, setOwners] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // Form States
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [logo, setLogo] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStoresAndOwners = async () => {
    try {
      const storesRes = await api.get('/superadmin/stores');
      setStores(storesRes.stores || []);

      const usersRes = await api.get('/superadmin/users');
      const allOwners = (usersRes.users || []).filter((u: User) => u.role === 'OWNER');
      setOwners(allOwners);
      if (allOwners.length > 0) setOwnerId(allOwners[0].id);
    } catch (err) {
      console.error('Failed to load stores & owners:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStoresAndOwners();
  }, []);

  const openAdd = () => {
    setName('');
    setAddress('');
    setPhone('');
    setLogo('');
    if (owners.length > 0) setOwnerId(owners[0].id);
    setError('');
    setIsAddOpen(true);
  };

  const openEdit = (store: Store) => {
    setSelectedStore(store);
    setName(store.name);
    setAddress(store.address || '');
    setPhone(store.phone || '');
    setLogo(store.logo || '');
    setOwnerId(store.ownerId);
    setError('');
    setIsEditOpen(true);
  };

  const openDelete = (store: Store) => {
    setSelectedStore(store);
    setIsDeleteOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ownerId) {
      setError('Nama outlet dan owner wajib diisi');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await api.post('/superadmin/stores', { name, address, phone, logo, ownerId });
      setIsAddOpen(false);
      fetchStoresAndOwners();
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan outlet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore) return;
    if (!name || !ownerId) {
      setError('Nama outlet dan owner wajib diisi');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await api.put(`/superadmin/stores/${selectedStore.id}`, { name, address, phone, logo, ownerId });
      setIsEditOpen(false);
      fetchStoresAndOwners();
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah outlet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedStore) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/superadmin/stores/${selectedStore.id}`);
      setIsDeleteOpen(false);
      fetchStoresAndOwners();
    } catch (err) {
      console.error('Failed to delete store:', err);
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
    <div className="flex flex-col gap-6 md:gap-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-500" />
            <span>Manajemen Outlet</span>
          </h1>
          <p className="text-xs text-slate-655 dark:text-slate-400 mt-1">Daftar toko, pairing code kasir, dan integrasi merchant.</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 self-start">
          <Plus className="h-4.5 w-4.5" />
          Registrasi Toko Baru
        </Button>
      </div>

      {/* Main Table Card */}
      <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/10">
        <CardContent className="p-0">
          {stores.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">Belum ada merchant terdaftar di sistem.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-900">
                  <tr>
                    <th className="px-6 py-4">Toko / Outlet</th>
                    <th className="px-6 py-4">Owner / Mitra</th>
                    <th className="px-6 py-4">Kontak</th>
                    <th className="px-6 py-4">Pairing Code</th>
                    <th className="px-6 py-4 text-center">Statistik</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900/50">
                  {stores.map((store) => (
                    <tr key={store.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {store.logo ? (
                            <img src={store.logo} alt={store.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-800" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-transparent">
                              {store.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="block font-bold text-slate-900 dark:text-white text-sm">{store.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{store.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{store.owner.name}</span>
                          <span className="text-[10px] text-slate-500">{store.owner.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                          {store.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {store.phone}</span>}
                          {store.address && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {store.address}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded font-mono text-[10px] text-indigo-650 dark:text-indigo-400 font-semibold flex items-center gap-1.5 w-fit">
                          <Key className="h-3.5 w-3.5" />
                          {store.pairingCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-3 text-[10px]">
                          <span className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                            Cabang: <b className="text-slate-900 dark:text-white">{store._count.branches}</b>
                          </span>
                          <span className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                            Produk: <b className="text-slate-900 dark:text-white">{store._count.products}</b>
                          </span>
                          <span className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                            Kasir: <b className="text-slate-900 dark:text-white">{store._count.cashiers}</b>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(store)}
                            className="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Edit Outlet"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDelete(store)}
                            className="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-red-500/10 dark:hover:bg-red-950/20 text-slate-500 dark:text-slate-450 hover:text-red-650 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Outlet"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* dialog Add Store */}
      <Dialog isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Registrasi Toko Baru" description="Masukkan data merchant untuk mendaftarkan unit usaha baru.">
        <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
          {error && <div className="p-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold">{error}</div>}
          
          <Input id="add-store-name" label="Nama Toko / Brand *" placeholder="KopiMu Cafe" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input id="add-store-address" label="Alamat Outlet" placeholder="Jl. Pemuda No. 120" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input id="add-store-phone" label="No Telepon" placeholder="0812345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input id="add-store-logo" label="Link URL Logo" placeholder="https://unsplash.com/..." value={logo} onChange={(e) => setLogo(e.target.value)} />
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pilih Owner / Mitra *</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3.5 py-2.5 rounded-lg outline-none focus:border-blue-500 transition-all font-bold w-full"
              required
            >
              {owners.length === 0 ? (
                <option value="">Belum ada akun Owner terdaftar</option>
              ) : (
                owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>{owner.name} ({owner.email})</option>
                ))
              )}
            </select>
          </div>

          <Button type="submit" variant="primary" className="w-full mt-2 font-bold" isLoading={isSubmitting}>
            Simpan Toko
          </Button>
        </form>
      </Dialog>

      {/* dialog Edit Store */}
      <Dialog isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Data Toko" description="Ubah informasi outlet merchant.">
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          {error && <div className="p-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold">{error}</div>}
          
          <Input id="edit-store-name" label="Nama Toko / Brand *" placeholder="KopiMu Cafe" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input id="edit-store-address" label="Alamat Outlet" placeholder="Jl. Pemuda No. 120" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input id="edit-store-phone" label="No Telepon" placeholder="0812345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input id="edit-store-logo" label="Link URL Logo" placeholder="https://unsplash.com/..." value={logo} onChange={(e) => setLogo(e.target.value)} />
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pilih Owner / Mitra *</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3.5 py-2.5 rounded-lg outline-none focus:border-blue-500 transition-all font-bold w-full"
              required
            >
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.name} ({owner.email})</option>
              ))}
            </select>
          </div>

          <Button type="submit" variant="primary" className="w-full mt-2 font-bold" isLoading={isSubmitting}>
            Simpan Perubahan
          </Button>
        </form>
      </Dialog>

      {/* dialog Delete Store */}
      <Dialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Hapus Outlet" description="Apakah Anda yakin ingin menghapus outlet ini beserta seluruh cabang, kasir, produk, dan riwayat transaksinya? Tindakan ini tidak dapat dibatalkan.">
        <div className="flex items-center gap-4 bg-red-950/20 border border-red-500/20 p-4 rounded-xl mb-4">
          <Trash2 className="h-10 w-10 text-red-500 shrink-0" />
          <div>
            <span className="block text-xs font-bold text-red-400">Konfirmasi Penghapusan Toko</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">Nama Toko: <b className="text-white">{selectedStore?.name}</b></span>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button onClick={() => setIsDeleteOpen(false)} variant="outline" className="font-bold">
            Batalkan
          </Button>
          <Button onClick={handleDeleteSubmit} variant="destructive" className="bg-red-600 hover:bg-red-750 text-white font-bold" isLoading={isSubmitting}>
            Ya, Hapus Toko
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
