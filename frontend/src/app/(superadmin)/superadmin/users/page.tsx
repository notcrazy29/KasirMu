'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  ShieldAlert, 
  Mail, 
  User as UserIcon,
  Store,
  Key,
  Play,
  Lock,
  Unlock
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface StoreItem {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'CASHIER' | 'SUPER_ADMIN';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  storeId: string | null;
  store: StoreItem | null;
  ownedStores: StoreItem[];
}

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const login = useAuthStore((state) => state.login);

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleImpersonate = async (targetUser: User) => {
    try {
      const res = await api.post('/admin/impersonate', { userId: targetUser.id });
      
      localStorage.setItem('kasirmu_original_token', localStorage.getItem('kasirmu_token') || '');
      localStorage.setItem('kasirmu_original_user', localStorage.getItem('kasirmu_user') || '');
      localStorage.setItem('kasirmu_original_stores', localStorage.getItem('kasirmu_stores') || '[]');
      
      login(res.user, res.token, res.stores || []);
      window.location.href = '/dashboard';
    } catch (err: any) {
      alert(err.message || 'Gagal masuk sebagai Owner');
    }
  };

  const handleToggleSuspend = async (targetUser: User) => {
    try {
      const nextStatus = targetUser.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
      await api.patch('/admin/users/suspend', { 
        userId: targetUser.id,
        status: nextStatus
      });
      fetchUsersAndStores();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status penangguhan');
    }
  };

  // Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'OWNER' | 'CASHIER' | 'SUPER_ADMIN'>('OWNER');
  const [storeId, setStoreId] = useState<string>('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsersAndStores = async () => {
    try {
      const usersRes = await api.get('/superadmin/users');
      setUsers(usersRes.users || []);

      const storesRes = await api.get('/superadmin/stores');
      setStores(storesRes.stores || []);
      if (storesRes.stores && storesRes.stores.length > 0) {
        setStoreId(storesRes.stores[0].id);
      }
    } catch (err) {
      console.error('Failed to load users & stores:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndStores();
  }, []);

  const openAdd = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('OWNER');
    if (stores.length > 0) setStoreId(stores[0].id);
    setError('');
    setIsAddOpen(true);
  };

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword('');
    setRole(user.role);
    setStoreId(user.storeId || (stores.length > 0 ? stores[0].id : ''));
    setError('');
    setIsEditOpen(true);
  };

  const openDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Nama, Email, dan Password wajib diisi');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await api.post('/superadmin/users', { 
        name, 
        email, 
        password, 
        role, 
        storeId: role === 'CASHIER' ? storeId : null 
      });
      setIsAddOpen(false);
      fetchUsersAndStores();
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan pengguna');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!name || !email) {
      setError('Nama dan Email wajib diisi');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await api.put(`/superadmin/users/${selectedUser.id}`, { 
        name, 
        email, 
        role, 
        storeId: role === 'CASHIER' ? storeId : null,
        password: password ? password : null
      });
      setIsEditOpen(false);
      fetchUsersAndStores();
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah pengguna');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/superadmin/users/${selectedUser.id}`);
      setIsDeleteOpen(false);
      fetchUsersAndStores();
    } catch (err) {
      console.error('Failed to delete user:', err);
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
            <Users className="h-6 w-6 text-blue-500" />
            <span>Manajemen Pengguna</span>
          </h1>
          <p className="text-xs text-slate-655 dark:text-slate-400 mt-1">Daftar akun Owner, Kasir/Staff, dan Super Admin di sistem.</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 self-start">
          <Plus className="h-4.5 w-4.5" />
          Registrasi Pengguna Baru
        </Button>
      </div>

      {/* Users Table Card */}
      <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/10">
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">Belum ada pengguna terdaftar di sistem.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-bold text-slate-550 dark:text-slate-400 border-b border-slate-100 dark:border-slate-900">
                  <tr>
                    <th className="px-6 py-4">Nama Pengguna</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Peran / Role</th>
                    <th className="px-6 py-4">Asosiasi Toko / Outlet</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-900/50">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-transparent">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-950 dark:text-white text-sm flex items-center gap-2">
                              {u.name}
                              <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-bold leading-none ${
                                u.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/10' :
                                u.status === 'PENDING' ? 'bg-amber-950 text-amber-400 border border-amber-500/10' :
                                'bg-red-950 text-red-400 border border-red-500/10'
                              }`}>
                                {u.status}
                              </span>
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono block mt-0.5">{u.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <Mail className="h-3.5 w-3.5" />
                          {u.email}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          u.role === 'SUPER_ADMIN' 
                            ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-400 border border-red-250 dark:border-red-500/10' 
                            : u.role === 'OWNER'
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-400 border border-blue-250 dark:border-blue-500/10'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-500/10'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {u.role === 'CASHIER' ? (
                          u.store ? (
                            <span className="flex items-center gap-1 text-[11px] text-slate-800 dark:text-slate-300">
                              <Store className="h-3.5 w-3.5 text-emerald-500" />
                              {u.store.name}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Belum Paired</span>
                          )
                        ) : u.role === 'OWNER' ? (
                          u.ownedStores.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {u.ownedStores.map((os) => (
                                <span key={os.id} className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                                  <Store className="h-3 w-3 text-blue-500" />
                                  {os.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">0 Toko</span>
                          )
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {u.role === 'OWNER' && u.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleImpersonate(u)}
                              className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg transition-colors cursor-pointer"
                              title="Login as Owner (Impersonate)"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          )}
                          {u.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => handleToggleSuspend(u)}
                              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                u.status === 'SUSPENDED' 
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500' 
                                  : 'bg-red-500/10 hover:bg-red-500/20 text-red-500'
                              }`}
                              title={u.status === 'SUSPENDED' ? 'Aktifkan Kembali' : 'Suspend / Blokir'}
                            >
                              {u.status === 'SUSPENDED' ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(u)}
                            className="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Edit Pengguna"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDelete(u)}
                            className="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-red-500/10 dark:hover:bg-red-950/20 text-slate-500 dark:text-slate-450 hover:text-red-650 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Pengguna"
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

      {/* dialog Add User */}
      <Dialog isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Registrasi Pengguna Baru" description="Buat kredensial login baru untuk Owner, Kasir, atau Super Admin.">
        <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
          {error && <div className="p-3 bg-red-955/30 border border-red-500/25 text-red-400 rounded-lg text-xs font-semibold">{error}</div>}
          
          <Input id="add-user-name" label="Nama Lengkap *" placeholder="Siti Aminah" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input id="add-user-email" label="Email Login / ID *" placeholder="siti@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input id="add-user-password" label="Kata Sandi Baru *" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Peran Pengguna (Role) *</label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as any);
                setError('');
              }}
              className="bg-slate-955 border border-slate-800 text-slate-200 text-xs px-3.5 py-2.5 rounded-lg outline-none focus:border-blue-500 transition-all font-bold w-full"
              required
            >
              <option value="OWNER">OWNER (Mitra Merchant)</option>
              <option value="CASHIER">CASHIER (Staf Toko)</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN (Admin Utama)</option>
            </select>
          </div>

          {role === 'CASHIER' && (
            <div className="flex flex-col gap-1.5 animate-fadeIn">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Kaitkan ke Toko / Outlet *</label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="bg-slate-955 border border-slate-800 text-slate-200 text-xs px-3.5 py-2.5 rounded-lg outline-none focus:border-blue-500 transition-all font-bold w-full"
                required
              >
                {stores.length === 0 ? (
                  <option value="">Belum ada outlet terdaftar</option>
                ) : (
                  stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))
                )}
              </select>
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full mt-2 font-bold" isLoading={isSubmitting}>
            Simpan Pengguna
          </Button>
        </form>
      </Dialog>

      {/* dialog Edit User */}
      <Dialog isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Profil Pengguna" description="Ubah kredensial dan hak akses user.">
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          {error && <div className="p-3 bg-red-955/30 border border-red-500/25 text-red-400 rounded-lg text-xs font-semibold">{error}</div>}
          
          <Input id="edit-user-name" label="Nama Lengkap *" placeholder="Siti Aminah" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input id="edit-user-email" label="Email Login / ID *" placeholder="siti@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ganti Kata Sandi (Kosongkan jika tidak diubah)</label>
            <Input id="edit-user-password" type="password" placeholder="•••••••• (Ganti password)" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Peran Pengguna (Role) *</label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as any);
                setError('');
              }}
              className="bg-slate-955 border border-slate-800 text-slate-200 text-xs px-3.5 py-2.5 rounded-lg outline-none focus:border-blue-500 transition-all font-bold w-full"
              required
            >
              <option value="OWNER">OWNER (Mitra Merchant)</option>
              <option value="CASHIER">CASHIER (Staf Toko)</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN (Admin Utama)</option>
            </select>
          </div>

          {role === 'CASHIER' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Kaitkan ke Toko / Outlet *</label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="bg-slate-955 border border-slate-800 text-slate-200 text-xs px-3.5 py-2.5 rounded-lg outline-none focus:border-blue-500 transition-all font-bold w-full"
                required
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full mt-2 font-bold" isLoading={isSubmitting}>
            Simpan Perubahan
          </Button>
        </form>
      </Dialog>

      {/* dialog Delete User */}
      <Dialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Hapus Pengguna" description="Apakah Anda yakin ingin menghapus akun pengguna ini? Tindakan ini akan membatalkan sesi login pengguna dan menghapus data terkait mereka.">
        <div className="flex items-center gap-4 bg-red-955/20 border border-red-500/20 p-4 rounded-xl mb-4">
          <Trash2 className="h-10 w-10 text-red-500 shrink-0" />
          <div>
            <span className="block text-xs font-bold text-red-400">Konfirmasi Penghapusan User</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">Nama: <b className="text-white">{selectedUser?.name}</b></span>
            <span className="block text-[10px] text-slate-550 mt-0.5">Email: <b className="text-white">{selectedUser?.email}</b></span>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button onClick={() => setIsDeleteOpen(false)} variant="outline" className="font-bold">
            Batalkan
          </Button>
          <Button onClick={handleDeleteSubmit} variant="destructive" className="bg-red-600 hover:bg-red-750 text-white font-bold" isLoading={isSubmitting}>
            Ya, Hapus Akun
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
