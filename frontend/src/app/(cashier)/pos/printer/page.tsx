'use client';

import React from 'react';
import PrinterManager from '@/components/printer/PrinterManager';

export default function CashierPrinterPage() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Printer Kasir
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Kelola perangkat printer Bluetooth thermal kasir untuk mencetak struk transaksi.
        </p>
      </div>

      <PrinterManager />
    </div>
  );
}
