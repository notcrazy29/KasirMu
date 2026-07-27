'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Card, { CardContent } from '@/components/ui/Card';
import { 
  History, 
  Search, 
  Filter, 
  Store, 
  User,
  Calendar,
  DollarSign
} from 'lucide-react';

interface Transaction {
  id: string;
  transactionNumber: string;
  total: string;
  paymentMethod: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  cashier: {
    name: string;
    email: string;
  };
  store: {
    id: string;
    name: string;
  };
  branch: {
    id: string;
    name: string;
  } | null;
}

export default function SuperAdminTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTx, setFilteredTx] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchTransactions = async () => {
    try {
      const response = await api.get('/superadmin/transactions');
      setTransactions(response.transactions || []);
      setFilteredTx(response.transactions || []);
    } catch (err) {
      console.error('Failed to load global transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Filter logic
  useEffect(() => {
    let result = [...transactions];

    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.transactionNumber.toLowerCase().includes(query) ||
          tx.cashier.name.toLowerCase().includes(query) ||
          tx.store.name.toLowerCase().includes(query)
      );
    }

    if (storeFilter) {
      result = result.filter((tx) => tx.store.id === storeFilter);
    }

    if (statusFilter) {
      result = result.filter((tx) => tx.status === statusFilter);
    }

    setFilteredTx(result);
  }, [search, storeFilter, statusFilter, transactions]);

  // Extract unique stores for dropdown filter
  const uniqueStoresMap = new Map<string, string>();
  transactions.forEach((tx) => {
    uniqueStoresMap.set(tx.store.id, tx.store.name);
  });
  const uniqueStores = Array.from(uniqueStoresMap.entries()).map(([id, name]) => ({ id, name }));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
          <History className="h-6 w-6 text-blue-500" />
          <span>Log Transaksi Global</span>
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Audit seluruh riwayat penjualan merchant merchant KasirMu.</p>
      </div>

      {/* Search & Filters */}
      <div className="grid md:grid-cols-4 gap-4 bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 p-4 rounded-xl">
        {/* Search */}
        <div className="md:col-span-2 relative">
          <input
            type="text"
            placeholder="Cari transaksi, kasir, atau nama toko..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-lg text-xs py-2.5 pl-10 pr-4 outline-none font-medium text-slate-800 dark:text-slate-200 transition-all"
          />
          <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* Filter Toko */}
        <div className="relative">
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-blue-500 rounded-lg text-xs py-2.5 px-3 outline-none font-bold text-slate-600 dark:text-slate-400 transition-all appearance-none cursor-pointer"
          >
            <option value="">Semua Outlet</option>
            {uniqueStores.map((st) => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
          <Filter className="h-3.5 w-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Filter Status */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-blue-500 rounded-lg text-xs py-2.5 px-3 outline-none font-bold text-slate-600 dark:text-slate-400 transition-all appearance-none cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="PAID">Lunas (PAID)</option>
            <option value="PENDING">Menunggu (PENDING)</option>
            <option value="FAILED">Gagal (FAILED)</option>
            <option value="CANCELLED">Batal (CANCELLED)</option>
          </select>
          <Filter className="h-3.5 w-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Table Card */}
      <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/10">
        <CardContent className="p-0">
          {filteredTx.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">Tidak ada transaksi yang cocok dengan kriteria filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-900">
                  <tr>
                    <th className="px-6 py-4">No Transaksi</th>
                    <th className="px-6 py-4">Toko / Outlet</th>
                    <th className="px-6 py-4">Kasir Pemroses</th>
                    <th className="px-6 py-4">Tanggal & Waktu</th>
                    <th className="px-6 py-4">Metode Bayar</th>
                    <th className="px-6 py-4 text-right">Total Belanja</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900/50">
                  {filteredTx.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white tracking-wide">
                        {tx.transactionNumber}
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                          <Store className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <div>
                            <span className="block font-semibold">{tx.store.name}</span>
                            {tx.branch && <span className="block text-[9px] text-slate-500">Cabang: {tx.branch.name}</span>}
                          </div>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <div>
                            <span className="block text-slate-800 dark:text-slate-200 font-semibold">{tx.cashier.name}</span>
                            <span className="block text-[9px] text-slate-500">{tx.cashier.email}</span>
                          </div>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-650 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          {formatDate(tx.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase">
                          {tx.paymentMethod}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white text-sm">
                        {formatCurrency(Number(tx.total))}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          tx.status === 'PAID' 
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-500/10' 
                            : tx.status === 'PENDING'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-250 dark:border-amber-500/10'
                            : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-400 border border-red-250 dark:border-red-500/10'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
