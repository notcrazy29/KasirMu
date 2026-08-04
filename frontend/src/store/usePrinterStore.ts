import { create } from 'zustand';
import { bluetoothPrinter } from '@/lib/bluetoothPrinter';
import { generateReceipt, generateTestReceipt, ReceiptData } from '@/lib/escpos';

export type PrinterStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';

interface StoredPrinterInfo {
  deviceId: string;
  deviceName: string;
  lastConnected: string;
}

interface PrinterState {
  status: PrinterStatus;
  deviceName: string | null;
  deviceId: string | null;
  lastConnected: string | null;
  errorMessage: string | null;
  isSupported: boolean;

  // Actions
  init: () => void;
  connectPrinter: () => Promise<void>;
  disconnectPrinter: () => void;
  autoReconnect: () => Promise<boolean>;
  printReceipt: (data: ReceiptData) => Promise<boolean>;
  printTestReceipt: () => Promise<boolean>;
  clearError: () => void;
}

const STORAGE_KEY = 'kasirmu_bluetooth_printer_device';

export const usePrinterStore = create<PrinterState>((set, get) => {
  // Wire up disconnect listener once
  if (typeof window !== 'undefined' && bluetoothPrinter.isSupported()) {
    bluetoothPrinter.onDisconnect((device) => {
      set({
        status: 'DISCONNECTED',
        errorMessage: 'Koneksi printer terputus. Klik Hubungkan Ulang untuk mencoba kembali.',
      });
    });
  }

  return {
    status: 'DISCONNECTED',
    deviceName: null,
    deviceId: null,
    lastConnected: null,
    errorMessage: null,
    isSupported: typeof window !== 'undefined' ? bluetoothPrinter.isSupported() : false,

    init: () => {
      if (typeof window === 'undefined') return;

      const supported = bluetoothPrinter.isSupported();
      set({ isSupported: supported });

      // Load saved device metadata from localStorage
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        try {
          const saved: StoredPrinterInfo = JSON.parse(savedRaw);
          set({
            deviceId: saved.deviceId,
            deviceName: saved.deviceName,
            lastConnected: saved.lastConnected,
          });

          // Attempt background auto-reconnect if supported
          if (supported) {
            get().autoReconnect().catch((err) => {
              console.warn('[PrinterStore] Auto-reconnect on init failed:', err);
            });
          }
        } catch (e) {
          console.error('[PrinterStore] Failed parsing stored printer:', e);
        }
      }
    },

    connectPrinter: async () => {
      set({ status: 'CONNECTING', errorMessage: null });

      if (!get().isSupported) {
        set({
          status: 'DISCONNECTED',
          errorMessage: 'Browser Anda tidak mendukung Web Bluetooth API. Gunakan Chrome Android/Desktop atau Edge.',
        });
        return;
      }

      try {
        const device = await bluetoothPrinter.requestDevice();
        const info = await bluetoothPrinter.connect(device);

        const nowStr = new Date().toLocaleString('id-ID');
        const savedData: StoredPrinterInfo = {
          deviceId: info.id,
          deviceName: info.name,
          lastConnected: nowStr,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));

        set({
          status: 'CONNECTED',
          deviceId: info.id,
          deviceName: info.name,
          lastConnected: nowStr,
          errorMessage: null,
        });
      } catch (err: any) {
        let msg = err.message || 'Gagal menghubungkan printer.';
        if (msg.includes('dibatalkan')) {
          msg = 'Pemilihan perangkat Bluetooth dibatalkan.';
        }
        set({
          status: 'DISCONNECTED',
          errorMessage: msg,
        });
      }
    },

    disconnectPrinter: () => {
      bluetoothPrinter.disconnect();
      set({
        status: 'DISCONNECTED',
        errorMessage: null,
      });
    },

    autoReconnect: async () => {
      const { deviceId, status } = get();
      if (status === 'CONNECTED' && bluetoothPrinter.isConnected()) {
        return true;
      }
      if (!deviceId || !get().isSupported) {
        return false;
      }

      set({ status: 'CONNECTING', errorMessage: null });

      try {
        const grantedDevices = await bluetoothPrinter.getGrantedDevices();
        const targetDevice = grantedDevices.find((d) => d.id === deviceId);

        if (targetDevice) {
          const info = await bluetoothPrinter.connect(targetDevice);
          const nowStr = new Date().toLocaleString('id-ID');

          set({
            status: 'CONNECTED',
            deviceName: info.name,
            deviceId: info.id,
            lastConnected: nowStr,
            errorMessage: null,
          });

          // Update storage
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              deviceId: info.id,
              deviceName: info.name,
              lastConnected: nowStr,
            })
          );
          return true;
        } else {
          set({
            status: 'DISCONNECTED',
            errorMessage: 'Printer berada di luar jangkauan atau belum diizinkan.',
          });
          return false;
        }
      } catch (err: any) {
        console.warn('[PrinterStore] Auto-reconnect failed:', err);
        set({
          status: 'DISCONNECTED',
          errorMessage: err.message || 'Printer tidak aktif.',
        });
        return false;
      }
    },

    printReceipt: async (data: ReceiptData) => {
      const { status } = get();

      if (status !== 'CONNECTED' || !bluetoothPrinter.isConnected()) {
        // Attempt fast reconnect before printing
        const reconnected = await get().autoReconnect();
        if (!reconnected) {
          set({ errorMessage: 'Printer tidak aktif atau berada di luar jangkauan.' });
          return false;
        }
      }

      try {
        const binaryData = generateReceipt(data);
        await bluetoothPrinter.print(binaryData);
        set({ errorMessage: null });
        return true;
      } catch (err: any) {
        set({ errorMessage: err.message || 'Gagal mencetak struk ke printer.' });
        return false;
      }
    },

    printTestReceipt: async () => {
      const { status } = get();

      if (status !== 'CONNECTED' || !bluetoothPrinter.isConnected()) {
        const reconnected = await get().autoReconnect();
        if (!reconnected) {
          set({ errorMessage: 'Printer tidak aktif atau berada di luar jangkauan.' });
          return false;
        }
      }

      try {
        const binaryData = generateTestReceipt();
        await bluetoothPrinter.print(binaryData);
        set({ errorMessage: null });
        return true;
      } catch (err: any) {
        set({ errorMessage: err.message || 'Gagal melakukan tes cetak.' });
        return false;
      }
    },

    clearError: () => set({ errorMessage: null }),
  };
});
