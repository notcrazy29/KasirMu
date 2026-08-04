'use client';

import React from 'react';
import PrinterManager from '@/components/printer/PrinterManager';

export default function OwnerPrinterPage() {
  return (
    <div className="flex-1 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Pengaturan Printer
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Hubungkan dan atur printer thermal Bluetooth outlet Anda untuk cetak struk otomatis.
        </p>
      </div>

      <PrinterManager />
    </div>
  );
}
