'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';
import Card, { CardContent } from '@/components/ui/Card';
import Table, { TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Dialog from '@/components/ui/Dialog';
import { 
  Eye, 
  RefreshCw, 
  HelpCircle,
  FileCheck2,
  Calendar,
  Clock,
  Search,
  Filter,
  X
} from 'lucide-react';

interface TransactionItem {
  id: string;
  productName: string;
  price: string | number;
  quantity: number;
  total: string | number;
}

interface Payment {
  id: string;
  paymentType: string;
  transactionStatus: string;
  qrCodeUrl: string | null;
  expiryTime: string | null;
}

interface Transaction {
  id: string;
  transactionNumber: string;
  invoiceNumber?: string | null;
  queueNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  tableNumber?: string | null;
  orderType?: string | null;
  notes?: string | null;
  branch?: { name: string } | null;
  subtotal: string | number;
  discount: string | number;
  tax?: string | number | null;
  total: string | number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  cashier: { name: string };
  items: TransactionItem[];
  payment: Payment | null;
}

type PeriodOption = 'all' | 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'year' | 'custom';

export default function TransactionsHistoryPage() {
  const { currentStoreId } = useAuthStore();
  const socket = useSocket();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState<string | null>(null);

  // Search filter states
  const [filterPeriod, setFilterPeriod] = useState<PeriodOption>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterInvoice, setFilterInvoice] = useState('');
  const [filterCashier, setFilterCashier] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('ALL');
  const [filterOrderType, setFilterOrderType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterBranch, setFilterBranch] = useState('');

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  const fetchTransactions = useCallback(async () => {
    if (!currentStoreId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('storeId', currentStoreId);

      if (filterPeriod && filterPeriod !== 'all') params.append('period', filterPeriod);
      if (filterPeriod === 'custom') {
        if (filterStartDate) params.append('startDate', filterStartDate);
        if (filterEndDate) params.append('endDate', filterEndDate);
      }
      if (filterSearch) params.append('search', filterSearch);
      if (filterInvoice) params.append('invoiceNumber', filterInvoice);
      if (filterCashier) params.append('cashierName', filterCashier);
      if (filterProduct) params.append('productName', filterProduct);
      if (filterBranch) params.append('branchId', filterBranch);
      if (filterPaymentMethod && filterPaymentMethod !== 'ALL') params.append('paymentMethod', filterPaymentMethod);
      if (filterOrderType && filterOrderType !== 'ALL') params.append('orderType', filterOrderType);
      if (filterStatus && filterStatus !== 'ALL') params.append('status', filterStatus);

      const response = await api.get(`/transactions?${params.toString()}`);
      setTransactions(response.transactions);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentStoreId,
    filterPeriod,
    filterStartDate,
    filterEndDate,
    filterSearch,
    filterInvoice,
    filterCashier,
    filterProduct,
    filterBranch,
    filterPaymentMethod,
    filterOrderType,
    filterStatus,
  ]);

  const fetchBranches = async () => {
    if (!currentStoreId) return;
    try {
      const response = await api.get(`/stores/${currentStoreId}/branches`);
      setBranches(response.branches);
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchBranches();
  }, [fetchTransactions]);

  // Handle Socket status changes & midnight reset
  useEffect(() => {
    if (!socket.isConnected) return;

    socket.on('midnight_reset', () => {
      fetchTransactions();
    });

    socket.on('new_transaction', () => {
      fetchTransactions();
    });

    socket.on('payment_status', (update: any) => {
      fetchTransactions();
      if (selectedTx && selectedTx.id === update.transactionId) {
        setSelectedTx((prev) => (prev ? { ...prev, status: update.status } : null));
      }
    });

    return () => {
      socket.off('midnight_reset');
      socket.off('new_transaction');
      socket.off('payment_status');
    };
  }, [socket.isConnected, selectedTx, fetchTransactions]);

  const handleSimulateWebhook = async (txNumber: string) => {
    setIsSimulating(txNumber);
    try {
      await api.post('/payments/simulate-callback', {
        transactionNumber: txNumber,
        status: 'settlement',
      });
      await fetchTransactions();
    } catch (err) {
      console.error('Simulator webhook failed:', err);
    } finally {
      setIsSimulating(null);
    }
  };

  const handleViewDetails = (tx: Transaction) => {
    setSelectedTx(tx);
    setIsDetailOpen(true);
  };

  const resetAllFilters = () => {
    setFilterPeriod('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterSearch('');
    setFilterInvoice('');
    setFilterCashier('');
    setFilterProduct('');
    setFilterPaymentMethod('ALL');
    setFilterOrderType('ALL');
    setFilterStatus('ALL');
    setFilterBranch('');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Histori Transaksi Penjualan</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Seluruh arsip histori transaksi tersimpan permanen dan dapat difilter secara lengkap</p>
        </div>
        <Button
          variant="outline"
          className="font-bold flex items-center gap-1.5"
          onClick={fetchTransactions}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </Button>
      </div>

      {/* Period Quick Preset Buttons */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        {[
          { key: 'all', label: 'Semua Histori' },
          { key: 'today', label: 'Hari Ini' },
          { key: 'yesterday', label: 'Kemarin' },
          { key: '7days', label: 'Histori 7 Hari / Minggu Ini' },
          { key: '30days', label: 'Histori 30 Hari / Bulan Ini' },
          { key: 'year', label: 'Histori Tahun Ini' },
          { key: 'custom', label: 'Custom Tanggal' },
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => setFilterPeriod(p.key as PeriodOption)}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              filterPeriod === p.key
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range Picker */}
      {filterPeriod === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Dari:</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs px-3 py-1.5 text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Sampai:</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs px-3 py-1.5 text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={fetchTransactions}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold px-4 py-1.5 rounded-lg shadow-sm transition-colors"
          >
            Terapkan
          </button>
        </div>
      )}

      {/* Comprehensive Multi-Criteria Search Filter Panel */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/10 backdrop-blur">
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Global Search */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Pencarian Umum</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari semua data..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs pl-8 pr-3 py-2 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all shadow-sm"
                />
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {/* Invoice Filter */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">No. Invoice</label>
              <input
                type="text"
                placeholder="INV-2026..."
                value={filterInvoice}
                onChange={(e) => setFilterInvoice(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all shadow-sm"
              />
            </div>

            {/* Cashier Filter */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Kasir</label>
              <input
                type="text"
                placeholder="Nama kasir..."
                value={filterCashier}
                onChange={(e) => setFilterCashier(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all shadow-sm"
              />
            </div>

            {/* Product Filter */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Produk</label>
              <input
                type="text"
                placeholder="Nama menu/produk..."
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
            {/* Payment Method Filter */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Metode Pembayaran</label>
              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer shadow-sm"
              >
                <option value="ALL">Semua Metode</option>
                <option value="CASH">Tunai (CASH)</option>
                <option value="QRIS">QRIS</option>
              </select>
            </div>

            {/* Order Type Filter */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Jenis Pesanan</label>
              <select
                value={filterOrderType}
                onChange={(e) => setFilterOrderType(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer shadow-sm"
              >
                <option value="ALL">Semua Jenis</option>
                <option value="DINE_IN">Makan Di Tempat (Dine In)</option>
                <option value="TAKE_AWAY">Bawa Pulang (Take Away)</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer shadow-sm"
              >
                <option value="ALL">Semua Status</option>
                <option value="PAID">Lunas (PAID)</option>
                <option value="PENDING">Pending (PENDING)</option>
                <option value="CANCELLED">Batal (CANCELLED)</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                type="button"
                className="text-xs py-2 px-3 font-semibold h-9 flex items-center justify-center gap-1"
                onClick={resetAllFilters}
              >
                <X className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                variant="primary"
                type="button"
                className="text-xs py-2 px-4 font-bold h-9 flex items-center justify-center gap-1.5 shadow"
                onClick={fetchTransactions}
              >
                <Filter className="h-3.5 w-3.5" />
                Terapkan Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List Table Card */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Invoice / Kode</TableHead>
                  <TableHead>Waktu Checkout</TableHead>
                  <TableHead>Kasir</TableHead>
                  <TableHead>Jenis Pesanan</TableHead>
                  <TableHead className="text-right">Total Transaksi</TableHead>
                  <TableHead className="text-center">Metode</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center w-36">Tindakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-extrabold text-slate-900 dark:text-white text-xs">
                      <div>
                        <span>{tx.invoiceNumber || tx.transactionNumber}</span>
                        {tx.queueNumber && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold block mt-0.5">Antrian: {tx.queueNumber}</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{new Date(tx.createdAt).toLocaleDateString('id-ID')}</span>
                        <Clock className="h-3.5 w-3.5 text-slate-400 ml-1" />
                        <span>{new Date(tx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {tx.cashier?.name || 'Kasir'}
                    </TableCell>

                    <TableCell className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                      {tx.orderType || '-'}
                    </TableCell>

                    <TableCell className="text-right font-black text-slate-900 dark:text-white text-xs">
                      {formatCurrency(Number(tx.total))}
                    </TableCell>

                    <TableCell className="text-center font-bold text-xs">
                      <Badge variant="secondary">{tx.paymentMethod}</Badge>
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge 
                        variant={
                          tx.status === 'PAID' 
                            ? 'success' 
                            : tx.status === 'PENDING' 
                            ? 'warning' 
                            : 'danger'
                        }
                      >
                        {tx.status === 'PAID' ? 'Lunas' : tx.status === 'PENDING' ? 'Pending' : 'Batal'}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 justify-center">
                        <button
                          onClick={() => handleViewDetails(tx)}
                          className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-md cursor-pointer transition-colors"
                          title="Detail Item"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {tx.paymentMethod === 'QRIS' && tx.status === 'PENDING' && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-[10px] font-black tracking-wide uppercase px-2 py-1 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleSimulateWebhook(tx.transactionNumber)}
                            isLoading={isSimulating === tx.transactionNumber}
                          >
                            <FileCheck2 className="h-3 w-3" />
                            <span>Settle</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Tidak ada transaksi ditemukan untuk filter ini.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Details Modal */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTx(null);
        }}
        title={`Detail Transaksi: ${selectedTx?.invoiceNumber || selectedTx?.transactionNumber}`}
        description="Rincian item belanja dan status invoice pembayaran"
      >
        {selectedTx && (
          <div className="flex flex-col gap-6">
            {/* Meta */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block font-medium">No Invoice</span>
                <span className="text-slate-900 dark:text-white font-bold mt-0.5 block">{selectedTx.invoiceNumber || selectedTx.transactionNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">No Antrian</span>
                <span className="text-blue-600 dark:text-blue-400 font-extrabold mt-0.5 block text-sm">{selectedTx.queueNumber || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Jenis Pesanan</span>
                <span className="text-slate-900 dark:text-white font-bold mt-0.5 block uppercase">{selectedTx.orderType || '-'}</span>
              </div>
              {selectedTx.tableNumber && (
                <div>
                  <span className="text-slate-500 block font-medium">Nomor Meja</span>
                  <span className="text-slate-900 dark:text-white font-bold mt-0.5 block">{selectedTx.tableNumber}</span>
                </div>
              )}
              {selectedTx.branch?.name && (
                <div>
                  <span className="text-slate-500 block font-medium">Cabang</span>
                  <span className="text-slate-900 dark:text-white font-bold mt-0.5 block">{selectedTx.branch.name}</span>
                </div>
              )}
              <div>
                <span className="text-slate-500 block font-medium">Operator Kasir</span>
                <span className="text-slate-900 dark:text-white font-bold mt-0.5 block">{selectedTx.cashier.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Pelanggan</span>
                <span className="text-slate-900 dark:text-white font-bold mt-0.5 block">{selectedTx.customerName || '-'}</span>
              </div>
              {selectedTx.customerPhone && (
                <div>
                  <span className="text-slate-500 block font-medium">No Telepon</span>
                  <span className="text-slate-900 dark:text-white font-bold mt-0.5 block">{selectedTx.customerPhone}</span>
                </div>
              )}
              <div>
                <span className="text-slate-500 block font-medium">Waktu Checkout</span>
                <span className="text-slate-900 dark:text-white font-semibold mt-0.5 block">
                  {new Date(selectedTx.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Metode</span>
                <span className="text-slate-900 dark:text-white font-bold mt-0.5 block uppercase">{selectedTx.paymentMethod}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Status</span>
                <span className="mt-0.5 block">
                  <Badge variant={selectedTx.status === 'PAID' ? 'success' : selectedTx.status === 'PENDING' ? 'warning' : 'danger'}>
                    {selectedTx.status === 'PAID' ? 'LUNAS / SETTLED' : selectedTx.status === 'PENDING' ? 'PENDING CALLBACK' : 'BATAL / EXPIRED'}
                  </Badge>
                </span>
              </div>
            </div>

            {selectedTx.notes && (
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-500 block font-bold mb-1">Catatan Pesanan:</span>
                <span className="text-slate-800 dark:text-slate-200">{selectedTx.notes}</span>
              </div>
            )}

            {/* Items */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Daftar Item Belanja</span>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                <div className="bg-slate-100 dark:bg-slate-900 p-3 font-semibold text-slate-700 dark:text-slate-300 grid grid-cols-5 border-b border-slate-200 dark:border-slate-800">
                  <span className="col-span-2">Nama Produk</span>
                  <span className="text-right">Harga</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Total</span>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {selectedTx.items.map((item) => (
                    <div key={item.id} className="p-3 grid grid-cols-5 text-slate-600 dark:text-slate-300">
                      <span className="col-span-2 font-bold text-slate-900 dark:text-white">{item.productName}</span>
                      <span className="text-right">{formatCurrency(Number(item.price))}</span>
                      <span className="text-center">{item.quantity}</span>
                      <span className="text-right font-bold text-slate-900 dark:text-white">{formatCurrency(Number(item.total))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculations summary */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col gap-2 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal Belanja</span>
                <span>{formatCurrency(Number(selectedTx.subtotal))}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Potongan Diskon</span>
                <span className="text-red-500 dark:text-red-400">-{formatCurrency(Number(selectedTx.discount))}</span>
              </div>
              {selectedTx.tax !== undefined && Number(selectedTx.tax) > 0 && (
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Pajak Terbayar</span>
                  <span>{formatCurrency(Number(selectedTx.tax))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>Total Bersih</span>
                <span className="text-blue-600 dark:text-blue-400">{formatCurrency(Number(selectedTx.total))}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDetailOpen(false);
                  setSelectedTx(null);
                }}
              >
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
