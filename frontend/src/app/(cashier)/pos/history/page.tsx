'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Table, { TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { RefreshCw, Eye, Calendar, Clock } from 'lucide-react';

interface TransactionItem {
  id: string;
  productName: string;
  price: string | number;
  quantity: number;
  total: string | number;
}

interface Transaction {
  id: string;
  transactionNumber: string;
  subtotal: string | number;
  discount: string | number;
  total: string | number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  cashierId: string;
  items: TransactionItem[];
}

export default function CashierHistoryPage() {
  const { currentStoreId, user } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCashierTransactions = async () => {
    if (!currentStoreId) return;
    try {
      const response = await api.get(`/transactions?storeId=${currentStoreId}`);
      // Filter only transactions performed by this cashier
      const filtered = response.transactions.filter(
        (tx: Transaction) => tx.cashierId === user?.id
      );
      setTransactions(filtered);
    } catch (err) {
      console.error('Failed to load cashier history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCashierTransactions();
  }, [currentStoreId]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const activeTxList = transactions || [];

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Histori Shift Anda</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Daftar transaksi yang Anda layani selama shift berjalan</p>
        </div>
        <Button
          variant="outline"
          className="font-bold flex items-center gap-1.5 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          onClick={fetchCashierTransactions}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </Button>
      </div>

      {/* History table */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : activeTxList.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Invoice</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead className="text-right">Total Transaksi</TableHead>
                  <TableHead className="text-center">Metode</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center w-24">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTxList.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-extrabold text-slate-900 dark:text-white text-xs">
                      {tx.transactionNumber}
                    </TableCell>

                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{new Date(tx.createdAt).toLocaleDateString('id-ID')}</span>
                        <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 ml-1.5" />
                        <span>{new Date(tx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
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
                        {tx.status === 'PAID' ? 'Lunas' : tx.status === 'PENDING' ? 'Pending' : 'Gagal'}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => {
                            setSelectedTx(tx);
                            setIsDetailOpen(true);
                          }}
                          className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-md cursor-pointer transition-colors"
                          title="Lihat Detail"
                        >
                          <Eye className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Belum ada transaksi terekam oleh Anda pada shift ini.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTx(null);
        }}
        title={`Rincian Transaksi: ${selectedTx?.transactionNumber}`}
        description="Detail daftar menu dibeli dan data pembayaran invoice"
      >
        {selectedTx && (
          <div className="flex flex-col gap-5">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-4 bg-slate-100 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-medium">Waktu Checkout</span>
                <span className="text-slate-900 dark:text-white font-bold mt-1 block">
                  {new Date(selectedTx.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-medium">Metode Pembayaran</span>
                <span className="text-slate-900 dark:text-white font-bold mt-1 block uppercase">{selectedTx.paymentMethod}</span>
              </div>
            </div>

            {/* List */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Daftar Menu</span>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                <div className="bg-slate-100 dark:bg-slate-900 p-3 font-semibold text-slate-700 dark:text-slate-300 grid grid-cols-5 border-b border-slate-200 dark:border-slate-800">
                  <span className="col-span-2">Item</span>
                  <span className="text-right">Harga</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Total</span>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {selectedTx.items.map((item) => (
                    <div key={item.id} className="p-3 grid grid-cols-5 text-slate-700 dark:text-slate-300">
                      <span className="col-span-2 font-bold text-slate-900 dark:text-white">{item.productName}</span>
                      <span className="text-right">{formatCurrency(Number(item.price))}</span>
                      <span className="text-center">{item.quantity}</span>
                      <span className="text-right font-bold text-slate-900 dark:text-white">{formatCurrency(Number(item.total))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col gap-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span>{formatCurrency(Number(selectedTx.subtotal))}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Diskon</span>
                <span className="text-red-500 dark:text-red-400">-{formatCurrency(Number(selectedTx.discount))}</span>
              </div>
              <div className="flex justify-between font-black text-slate-900 dark:text-white text-sm pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>Total Bayar</span>
                <span className="text-blue-600 dark:text-blue-400">{formatCurrency(Number(selectedTx.total))}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-2">
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
