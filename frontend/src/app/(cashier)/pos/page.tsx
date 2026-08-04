'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore, Product } from '@/store/useCartStore';
import { usePrinterStore } from '@/store/usePrinterStore';
import { ReceiptData } from '@/lib/escpos';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Dialog from '@/components/ui/Dialog';
import Badge from '@/components/ui/Badge';
import { Html5QrcodeScanner } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { 
  Search, 
  QrCode, 
  Trash, 
  Plus, 
  Minus, 
  Check, 
  UserPlus, 
  KeyRound, 
  Smartphone,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  TicketPercent,
  Coins,
  ChevronRight,
  Printer,
  X
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import QRCode from 'qrcode';

const orderInfoSchema = z.object({
  customerName: z.string().max(100, 'Nama pelanggan maksimal 100 karakter').optional().nullable(),
  customerPhone: z.string().optional().nullable().refine(val => !val || /^[0-9+ -]{5,20}$/.test(val), {
    message: 'Nomor telepon tidak valid',
  }),
  orderType: z.enum(['DINE_IN', 'TAKE_AWAY']),
  tableNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.orderType === 'DINE_IN' && !data.tableNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Nomor meja wajib diisi untuk Dine In',
      path: ['tableNumber'],
    });
  }
});

type OrderInfoFormValues = z.infer<typeof orderInfoSchema>;

interface OrderInfoFormWrapperProps {
  onSubmit: (values: OrderInfoFormValues) => void;
  onClose: () => void;
  user: any;
  activeShift: any;
}

const OrderInfoFormWrapper = ({ onSubmit, onClose, user, activeShift }: OrderInfoFormWrapperProps) => {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<OrderInfoFormValues>({
    resolver: zodResolver(orderInfoSchema),
    defaultValues: {
      orderType: 'DINE_IN',
      customerName: '',
      customerPhone: '',
      tableNumber: '',
      notes: '',
    }
  });

  const watchOrderType = watch('orderType');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Readonly Metadata Info */}
      <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-550 dark:text-slate-400">
        <div>
          <span className="block text-[8px] font-black uppercase text-slate-400 dark:text-slate-550">Nama Kasir</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{user?.name || 'Kasir'}</span>
        </div>
        <div>
          <span className="block text-[8px] font-black uppercase text-slate-400 dark:text-slate-550">Waktu</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
            {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} @ {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div>
          <span className="block text-[8px] font-black uppercase text-slate-400 dark:text-slate-550">Cabang</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{user?.storeName || 'Cabang Utama'}</span>
        </div>
        <div>
          <span className="block text-[8px] font-black uppercase text-slate-400 dark:text-slate-555">Shift</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">#{activeShift?.id?.slice(0, 8) || 'Aktif'}</span>
        </div>
      </div>

      {/* Opsi Jenis Pesanan */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Jenis Pesanan *</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'DINE_IN', label: '🍽️ Dine In' },
            { value: 'TAKE_AWAY', label: '🥡 Take Away' },
          ].map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setValue('orderType', type.value as any, { shouldValidate: true })}
              className={`p-2.5 rounded-lg border text-center font-bold text-[11px] cursor-pointer transition-all ${
                watchOrderType === type.value
                  ? 'border-blue-500 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Conditional Table Number for Dine In */}
      {watchOrderType === 'DINE_IN' && (
        <Input
          id="tableNumber"
          label="Nomor Meja *"
          placeholder="Masukkan nomor meja (misal: 04, VIP-1)..."
          error={errors.tableNumber?.message || undefined}
          {...register('tableNumber')}
        />
      )}

      {/* Customer Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          id="customerName"
          label="Nama Pelanggan (Opsional)"
          placeholder="Nama customer..."
          maxLength={100}
          error={errors.customerName?.message || undefined}
          {...register('customerName')}
        />
        <Input
          id="customerPhone"
          label="Nomor Telepon (Opsional)"
          placeholder="Nomor HP customer..."
          error={errors.customerPhone?.message || undefined}
          {...register('customerPhone')}
        />
      </div>

      {/* Notes */}
      <div className="w-full flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Catatan Pesanan (Opsional)
        </label>
        <textarea
          id="notes"
          rows={2}
          placeholder="Catatan tambahan (misal: tidak pedas, ekstra keju)..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-sm px-3.5 py-2 transition-all outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          {...register('notes')}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800/60 pt-4 mt-2">
        <Button
          variant="outline"
          type="button"
          onClick={onClose}
        >
          Batal
        </Button>
        <Button
          variant="primary"
          type="submit"
        >
          Selanjutnya
        </Button>
      </div>
    </form>
  );
};

interface Category {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  startingCash: number;
  status: string;
}

interface PaymentDetails {
  id: string;
  qrData: string | null;
  qrCodeUrl: string | null;
  grossAmount: number;
  transactionStatus: string;
}

interface TransactionDetails {
  id: string;
  transactionNumber: string;
  invoiceNumber?: string | null;
  queueNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  tableNumber?: string | null;
  orderType?: string | null;
  notes?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentStatus?: string | null;
  status?: string | null;
  createdAt: string;
  store?: any;
}

export default function PosPage() {
  const { user, stores = [], currentStoreId, switchStore, login } = useAuthStore();
  const { cart, discount, addToCart, removeFromCart, updateQuantity, setDiscount, clearCart, getSubtotal, getTotal, getItemCount } = useCartStore();
  const socket = useSocket();

  const playCashRegisterSound = () => {
    if (typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      // Sound 1: Coin clink (high frequency sine wave decay)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(800, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.05);
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      // Sound 2: Bell ring (longer decay triangle wave)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1174.66, ctx.currentTime); // D6 note
      gain2.gain.setValueAtTime(0.1, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      // Play
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.3);
      osc2.stop(ctx.currentTime + 0.8);
    } catch (e) {
      // AudioContext fails if not interacted first, ignore
    }
  };

  // State managers
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pairing Flow
  const [pairingToken, setPairingToken] = useState('');
  const [isPairingError, setIsPairingError] = useState('');
  const [isPairingLoading, setIsPairingLoading] = useState(false);

  // Shift Start Flow
  const [startingCash, setStartingCash] = useState(200000);
  const [isShiftOpening, setIsShiftOpening] = useState(false);

  // Checkout Popups Flow
  const [checkoutMethod, setCheckoutMethod] = useState<'CASH' | 'QRIS'>('CASH');
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutResponse, setCheckoutResponse] = useState<{ transaction: TransactionDetails; payment: PaymentDetails } | null>(null);
  
  // Modals controllers
  const [isQrisDialogOpen, setIsQrisDialogOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [flatDiscount, setFlatDiscount] = useState(0);
  const [hasPaymentMethodError, setHasPaymentMethodError] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Step Wizard States
  const [isCheckoutWizardOpen, setIsCheckoutWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<'ORDER_INFO' | 'PREVIEW_PAYMENT' | 'QRIS_WAIT' | 'RECEIPT'>('ORDER_INFO');
  const [orderInfo, setOrderInfo] = useState<OrderInfoFormValues | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // QR Code Scanner Reference
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Tax Setting states
  const [taxSetting, setTaxSetting] = useState<{
    taxName: string;
    percentage: number;
    calculationType: 'INCLUSIVE' | 'EXCLUSIVE';
    isActive: boolean;
  } | null>(null);

  const getTaxAmount = () => {
    if (!taxSetting || !taxSetting.isActive) return 0;
    const base = getSubtotal() - discount < 0 ? 0 : getSubtotal() - discount;
    const pct = Number(taxSetting.percentage);
    if (taxSetting.calculationType === 'INCLUSIVE') {
      return Math.round(base - (base / (1 + (pct / 100))));
    } else {
      return Math.round(base * (pct / 100));
    }
  };

  const getGrandTotal = () => {
    const base = getSubtotal() - discount < 0 ? 0 : getSubtotal() - discount;
    if (!taxSetting || !taxSetting.isActive) return base;
    if (taxSetting.calculationType === 'INCLUSIVE') {
      return base;
    } else {
      return base + getTaxAmount();
    }
  };

  // Load Products, Categories, and Shift
  const fetchPosInitialData = async () => {
    if (!currentStoreId) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch active shift for cashier
      const shiftRes = await api.get(`/transactions/shifts/active?storeId=${currentStoreId}&userId=${user?.id}`);
      setActiveShift(shiftRes.shift);

      // 2. Fetch products and categories
      const prodRes = await api.get(`/products?storeId=${currentStoreId}`);
      setProducts(prodRes.products);

      const catRes = await api.get(`/products/categories?storeId=${currentStoreId}`);
      setCategories(catRes.categories);

      // 3. Fetch tax setting
      const taxRes = await api.get('/tax');
      setTaxSetting(taxRes.taxSetting);
    } catch (err) {
      console.error('Failed to load POS details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosInitialData();
    usePrinterStore.getState().init();
  }, [currentStoreId]);

  const triggerAutoPrintReceipt = (txRes: { transaction: TransactionDetails; payment?: PaymentDetails } | null) => {
    if (!txRes?.transaction) return;
    const tx = txRes.transaction;
    const receiptStore = tx.store || (stores || []).find((s) => s.id === currentStoreId) || (stores || [])[0];

    const receiptData: ReceiptData = {
      transactionNumber: tx.transactionNumber,
      invoiceNumber: tx.invoiceNumber,
      queueNumber: tx.queueNumber,
      customerName: tx.customerName || orderInfo?.customerName,
      customerPhone: tx.customerPhone || orderInfo?.customerPhone,
      tableNumber: tx.tableNumber || orderInfo?.tableNumber,
      orderType: tx.orderType || orderInfo?.orderType,
      cashierName: user?.name,
      createdAt: tx.createdAt,
      items: cart.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        price: Number(item.product.price),
        total: Number(item.product.price) * item.quantity,
      })),
      subtotal: Number(tx.subtotal || getSubtotal()),
      discount: Number(tx.discount || discount),
      tax: Number(tx.tax || 0),
      total: Number(tx.total || getGrandTotal()),
      paymentMethod: tx.paymentMethod,
      paymentStatus: tx.paymentStatus || 'LUNAS',
      store: {
        name: receiptStore?.name || (user as any)?.storeName || 'KasirMu Outlet',
        address: receiptStore?.address,
        district: receiptStore?.district,
        city: receiptStore?.city,
        province: receiptStore?.province,
        phone: receiptStore?.phone,
        whatsapp: receiptStore?.whatsapp,
        instagram: receiptStore?.instagram,
        website: receiptStore?.website,
        footerNote: receiptStore?.footerNote,
        logo: receiptStore?.logo,
      },
    };

    usePrinterStore.getState().printReceipt(receiptData);
  };

  // Load Midtrans Snap JS Script dynamically based on store-level client key from PaymentGateway table
  useEffect(() => {
    if (typeof window === 'undefined' || !currentStoreId) return;

    const loadSnapScript = async () => {
      try {
        // Fetch client key from PaymentGateway (never exposes server key)
        const gwRes = await api.get(`/stores/${currentStoreId}/payment-gateway/client-key`);
        const storeClientKey = gwRes?.clientKey || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || 'SB-Mid-client-placeholderkey';
        const isProduction = gwRes?.environment === 'PRODUCTION';

        const snapSrcUrl = isProduction
          ? 'https://app.midtrans.com/snap/snap.js'
          : 'https://app.sandbox.midtrans.com/snap/snap.js';

        // Remove any existing snap script to avoid client key mismatch
        document.querySelectorAll('script[data-snap-script]').forEach(s => s.remove());
        if ((window as any).snap) {
          delete (window as any).snap;
        }

        const script = document.createElement('script');
        script.src = snapSrcUrl;
        script.setAttribute('data-client-key', storeClientKey);
        script.setAttribute('data-snap-script', 'true');
        script.async = true;

        script.onload = () => {
          console.log(`[Snap JS] Loaded (${isProduction ? 'PRODUCTION' : 'SANDBOX'}) with key: ${storeClientKey.substring(0, 20)}...`);
        };

        document.body.appendChild(script);
      } catch (err) {
        console.error('Failed to load Snap credentials:', err);
      }
    };

    loadSnapScript();
  }, [currentStoreId]);

  // Trigger Midtrans Snap popup when waiting for QRIS/digital payment
  useEffect(() => {
    if (wizardStep === 'QRIS_WAIT' && (checkoutResponse?.transaction as any)?.snapToken) {
      const token = (checkoutResponse?.transaction as any)?.snapToken;
      if (token && !token.startsWith('mock-')) {
        const timer = setTimeout(() => {
          if ((window as any).snap) {
            try {
              // Use snap.pay() for the official full Midtrans popup
              // This shows ALL active payment channels (QRIS, GoPay, VA, CC, etc.)
              (window as any).snap.pay(token, {
                onSuccess: function (result: any) {
                  console.log('[Snap] Payment success:', result);
                },
                onPending: function (result: any) {
                  console.log('[Snap] Payment pending:', result);
                },
                onError: function (result: any) {
                  console.error('[Snap] Payment error:', result);
                  setHasPaymentMethodError(true);
                },
                onClose: function () {
                  console.log('[Snap] Customer closed payment popup');
                  // Don't change wizard step — let them close and re-open
                }
              });
            } catch (e) {
              console.error('Failed to open Midtrans Snap:', e);
            }
          } else {
            console.error('[Snap] Midtrans Snap JS is not loaded yet');
          }
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [wizardStep, checkoutResponse]);

  // Polling payment status fallback (updates backend and automatically triggers redirect)
  useEffect(() => {
    let intervalId: any = null;
    
    if (wizardStep === 'QRIS_WAIT' && checkoutResponse?.transaction?.id) {
      const txId = checkoutResponse.transaction.id;
      
      intervalId = setInterval(async () => {
        try {
          const res = await api.get(`/payment/status/${txId}`);
          const status = res.transaction?.status;
          
          if (status === 'PAID') {
            clearInterval(intervalId);
            playCashRegisterSound();
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 },
            });
            if (activeShift) {
              fetchPosInitialData();
            }
            setWizardStep('RECEIPT');
            triggerAutoPrintReceipt(checkoutResponse);
          } else if (status === 'FAILED' || status === 'EXPIRED' || status === 'CANCELLED') {
            clearInterval(intervalId);
            alert(`Transaksi pembayaran QRIS gagal atau kedaluwarsa: ${status}`);
            setWizardStep('PREVIEW_PAYMENT');
            setIsCheckoutLoading(false);
          }
        } catch (err) {
          console.warn('Error polling payment status:', err);
        }
      }, 3000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [wizardStep, checkoutResponse]);

  // Hook up QR Scanner when cashier is unpaired
  useEffect(() => {
    if (user?.storeId || typeof window === 'undefined') return;

    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      'qr-reader-panel',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      async (decodedText) => {
        try {
          // Parse JSON pairing payload
          const parsed = JSON.parse(decodedText);
          if (parsed.pairingCode) {
            scanner.clear();
            handlePairSubmit(parsed.pairingCode);
          }
        } catch (err) {
          // Fallback if scanned value is just a plain token string
          scanner.clear();
          handlePairSubmit(decodedText);
        }
      },
      (error) => {
        // scanner noise, ignore
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => {});
      }
    };
  }, [user?.storeId]);

  // Listen to live events (Socket.io)
  useEffect(() => {
    if (!socket.isConnected) return;

    // Sync inventory stock changes
    socket.on('stock_update', (update: { productId: string; newStock: number }) => {
      setProducts((prevProds) =>
        prevProds.map((p) => (p.id === update.productId ? { ...p, stock: update.newStock } : p))
      );
    });

    // Check payment statuses dynamically
    socket.on('payment_status', (update: { transactionId: string; status: string }) => {
      if (checkoutResponse && checkoutResponse.transaction.id === update.transactionId) {
        if (update.status === 'PAID') {
          // Settle QRIS payment! Trigger confetti celebration and play sound
          playCashRegisterSound();
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
          });

          // Update active shift locally if it was QRIS settled
          if (activeShift) {
            fetchPosInitialData();
          }

          setWizardStep('RECEIPT');
        } else if (update.status === 'FAILED' || update.status === 'EXPIRED') {
          alert(`Transaksi pembayaran QRIS gagal: ${update.status}`);
          setWizardStep('PREVIEW_PAYMENT');
          setIsCheckoutLoading(false);
        }
      }
    });

    return () => {
      socket.off('stock_update');
      socket.off('payment_status');
    };
  }, [socket.isConnected, checkoutResponse]);

  useEffect(() => {
    if (checkoutResponse?.transaction) {
      const qrContent = JSON.stringify({
        invoiceNumber: checkoutResponse.transaction.invoiceNumber || checkoutResponse.transaction.transactionNumber,
        transactionId: checkoutResponse.transaction.id,
      });
      QRCode.toDataURL(qrContent, { width: 120, margin: 1 })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Failed to generate QR Code:', err));
    }
  }, [checkoutResponse]);

  const handleOpenCheckoutWizard = () => {
    if (cart.length === 0) return;
    setHasPaymentMethodError(false);
    setOrderInfo(null);
    setWizardStep('ORDER_INFO');
    setIsCheckoutWizardOpen(true);
  };

  // Form Submission Handlers
  const handlePairSubmit = async (code: string) => {
    const targetCode = code.trim();
    if (!targetCode) return;

    setIsPairingLoading(true);
    setIsPairingError('');

    try {
      const response = await api.post('/cashiers/pair', { pairingCode: targetCode });
      
      // Update session store with new token (adds storeId context)
      login(response.user, response.token, []);
      switchStore(response.user.storeId);
      
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => {});
      }
    } catch (err: any) {
      setIsPairingError(err.message || 'Token pairing tidak valid');
    } finally {
      setIsPairingLoading(false);
    }
  };

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStoreId) return;

    setIsShiftOpening(true);
    try {
      const res = await api.post('/transactions/shifts/start', {
        startingCash: Number(startingCash),
        storeId: currentStoreId,
      });
      setActiveShift(res.shift);
    } catch (err: any) {
      alert(err.message || 'Gagal membuka shift kasir');
    } finally {
      setIsShiftOpening(false);
    }
  };

  const handleCheckoutSubmit = async (method: 'CASH' | 'QRIS') => {
    if (cart.length === 0 || !currentStoreId || !orderInfo) return;

    setIsCheckoutLoading(true);

    try {
      const response = await api.post('/transactions', {
        storeId: currentStoreId,
        discount: Number(flatDiscount),
        paymentMethod: method,
        customerName: orderInfo.customerName || null,
        customerPhone: orderInfo.customerPhone || null,
        tableNumber: orderInfo.tableNumber || null,
        orderType: orderInfo.orderType,
        notes: orderInfo.notes || null,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });

      setCheckoutResponse(response);

      if (method === 'QRIS') {
        setWizardStep('QRIS_WAIT');
      } else {
        // Tunai / CASH is settled instantly
        playCashRegisterSound();
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
        });

        // Update shift locally for cash transactions
        if (activeShift) {
          fetchPosInitialData();
        }

        setWizardStep('RECEIPT');
        triggerAutoPrintReceipt(response);
      }
    } catch (err: any) {
      alert(err.message || 'Checkout transaksi gagal');
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleResetCheckout = () => {
    setIsCheckoutWizardOpen(false);
    setWizardStep('ORDER_INFO');
    setOrderInfo(null);
    setCheckoutResponse(null);
    setQrCodeDataUrl('');
    clearCart();
    setFlatDiscount(0);
    setDiscount(0);
    setHasPaymentMethodError(false);
  };

  // Keyboard Barcode Simulator Input (Cashier scans physical barcode)
  const handleBarcodeSimulate = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const barcodeStr = e.currentTarget.value.trim();
      if (!barcodeStr) return;

      const matchedProduct = products.find(
        (p) => p.barcode?.toLowerCase() === barcodeStr.toLowerCase()
      );

      if (matchedProduct) {
        addToCart(matchedProduct);
        e.currentTarget.value = ''; // clear input
      } else {
        alert(`Produk dengan SKU Barcode '${barcodeStr}' tidak ditemukan`);
      }
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  // Render Loader
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  // Phase A: Unpaired Cashier -> QR scanner
  if (!user?.storeId) {
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center p-6 md:p-8">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

        <Card className="w-full max-w-lg border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-600/15 p-3 rounded-2xl text-blue-400">
                <QrCode className="h-8 w-8" />
              </div>
            </div>
            <CardTitle>Pairing Outlet Toko</CardTitle>
            <CardDescription>
              Scan QR Code pairing milik Owner di menu dashboard untuk menghubungkan kasir ke database toko
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {/* QR scanner camera canvas */}
            <div className="overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 rounded-xl p-2 max-w-[320px] mx-auto w-full">
              <div id="qr-reader-panel" className="rounded-lg overflow-hidden text-slate-400 text-xs" />
            </div>

            {/* Manual field */}
            <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 text-center">
              <span className="text-[10px] font-black text-slate-500 tracking-wider">TOKEN PAIRING MANUAL</span>
              <div className="flex gap-2 mt-2 max-w-sm mx-auto">
                <Input
                  id="pairToken"
                  type="text"
                  placeholder="Masukkan token pairing..."
                  value={pairingToken}
                  onChange={(e) => setPairingToken(e.target.value)}
                  disabled={isPairingLoading}
                  className="bg-white/60 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-center"
                />
                <Button
                  variant="primary"
                  className="font-bold shrink-0"
                  onClick={() => handlePairSubmit(pairingToken)}
                  disabled={isPairingLoading || !pairingToken}
                >
                  Hubungkan
                </Button>
              </div>
              {isPairingError && (
                <span className="block text-red-400 text-[11px] font-semibold mt-2">{isPairingError}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Phase B: Cashier Paired, but Shift Closed
  if (!activeShift) {
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center p-6 md:p-8">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

        <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-600/15 p-3 rounded-2xl text-blue-400">
                <KeyRound className="h-8 w-8" />
              </div>
            </div>
            <CardTitle>Buka Shift Kasir Baru</CardTitle>
            <CardDescription>
              Masukkan jumlah modal awal laci cash drawer untuk memulai transaksi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStartShift} className="flex flex-col gap-4">
              <Input
                id="cStartingCash"
                type="number"
                label="Modal Kas Awal (IDR)"
                value={startingCash || ''}
                onChange={(e) => setStartingCash(Number(e.target.value))}
                required
              />
              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2 font-bold"
                isLoading={isShiftOpening}
              >
                Mulai Shift Kasir
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Phase C: Paired & Active Shift -> POS Panel Workspace
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (activeCategory === '' || p.categoryId === activeCategory)
  );

  return (
    <div className="h-full flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
      {/* LEFT PANEL: PRODUCT CATALOG (Flex 1) */}
      <section className="flex-1 flex flex-col min-h-0 bg-slate-50/40 dark:bg-slate-950/40">
        {/* Search, Filter & Barcode */}
        <div className="p-4 bg-white/40 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-850 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 text-slate-500 h-4 w-4" />
            <input
              type="text"
              placeholder="Cari menu makanan, minuman..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs pl-9 pr-4 py-2 text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors shadow-sm"
            />
          </div>

          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Simulasi Barcode Reader (Ketik + Enter)..."
              onKeyDown={handleBarcodeSimulate}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs px-3 py-2 text-slate-800 dark:text-white font-mono outline-none focus:border-indigo-500 transition-colors shadow-sm"
            />
          </div>
        </div>

        {/* Categories Tab selector */}
        <div className="px-4 py-3 flex gap-2 overflow-x-auto shrink-0 border-b border-slate-200 dark:border-slate-850 bg-white/10 dark:bg-slate-900/10">
          <button
            onClick={() => setActiveCategory('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              activeCategory === ''
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm'
            }`}
          >
            Semua Menu
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                activeCategory === c.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Products Grid list */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((prod) => {
              const inCartItem = cart.find((i) => i.product.id === prod.id);
              const isOutOfStock = prod.stock <= 0;
              return (
                <div
                  key={prod.id}
                  onClick={() => !isOutOfStock && addToCart(prod)}
                  className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden flex flex-col group transition-all select-none cursor-pointer duration-150 active:scale-95 shadow-sm ${
                    isOutOfStock 
                      ? 'border-slate-200 dark:border-slate-850 opacity-40 cursor-not-allowed' 
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Image wrapper */}
                  <div className="aspect-square bg-slate-100 dark:bg-slate-950 flex items-center justify-center relative border-b border-slate-200 dark:border-slate-850 overflow-hidden">
                    {prod.image ? (
                      <img
                        src={prod.image}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <ShoppingBag className="h-8 w-8 text-slate-800" />
                    )}

                    {/* Stock badge indicator */}
                    <div className="absolute top-2 right-2">
                      <Badge variant={isOutOfStock ? 'danger' : prod.stock <= prod.minStockAlert ? 'warning' : 'secondary'}>
                        {isOutOfStock ? 'Habis' : `${prod.stock} pcs`}
                      </Badge>
                    </div>

                    {/* Cart counter floating badge */}
                    {inCartItem && (
                      <div className="absolute bottom-2 left-2 bg-blue-600 text-white font-black text-xs px-2.5 py-1 rounded-full shadow-lg">
                        {inCartItem.quantity}x
                      </div>
                    )}
                  </div>

                  {/* Pricing info */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between bg-white dark:bg-slate-900">
                    <span className="block font-bold text-slate-800 dark:text-white text-xs leading-tight line-clamp-2 truncate-lines">
                      {prod.name}
                    </span>
                    <span className="block font-extrabold text-blue-600 dark:text-blue-400 text-xs mt-2">
                      {formatCurrency(Number(prod.price))}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center text-slate-600 text-xs">
              Katalog produk kosong.
            </div>
          )}
        </div>
      </section>

      {/* RIGHT PANEL: ACTIVE SHOPPING CART & PAYMENT PANEL (Desktop: 360-384px, Mobile: Slide-up Drawer) */}
      <section className={`w-full lg:w-90 xl:w-96 shrink-0 bg-white dark:bg-slate-900 flex flex-col min-h-0 border-l border-slate-200 dark:border-slate-800 transition-all ${
        isMobileCartOpen 
          ? 'fixed inset-x-0 bottom-0 top-14 z-50 flex shadow-2xl animate-zoom-in' 
          : 'hidden lg:flex'
      }`}>
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">Keranjang POS</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="primary">{getItemCount()} item</Badge>
            {isMobileCartOpen && (
              <button 
                onClick={() => setIsMobileCartOpen(false)}
                className="lg:hidden text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto">
          {cart.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-850 p-3 flex flex-col gap-2">
              {cart.map((item) => (
                <div 
                  key={item.product.id} 
                  className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-850/60 rounded-xl p-3 flex gap-3 hover:border-slate-350 dark:hover:border-slate-850 transition-colors shadow-sm"
                >
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-slate-850 dark:text-white truncate">{item.product.name}</span>
                      <span className="block text-[10px] text-slate-500 mt-1">
                        {formatCurrency(Number(item.product.price))} / pcs
                      </span>
                    </div>

                    {/* Adjusters */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750 hover:text-slate-800 dark:hover:text-white cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 dark:text-white px-2">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750 hover:text-slate-800 dark:hover:text-white cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                        disabled={item.quantity >= item.product.stock}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end shrink-0">
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-500 hover:text-rose-500 p-1.5 cursor-pointer transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-black text-slate-800 dark:text-white">
                      {formatCurrency(Number(item.product.price) * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 gap-3">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-450 dark:text-slate-700">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <span className="text-xs">Klik item produk di samping untuk memasukkan ke keranjang kasir.</span>
            </div>
          )}
        </div>

        {/* Cart calculations panel */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-850 flex flex-col gap-4 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.015)]">
          <div className="flex flex-col gap-2.5 text-xs">
            {/* Subtotal */}
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-800 dark:text-slate-300">{formatCurrency(getSubtotal())}</span>
            </div>

            {/* Discount input */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                <TicketPercent className="h-3.5 w-3.5 text-amber-500" /> Diskon (Rp)
              </span>
              <input
                type="number"
                placeholder="0"
                value={flatDiscount || ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFlatDiscount(val);
                  setDiscount(val);
                }}
                disabled={cart.length === 0}
                className="w-28 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1.5 text-right text-xs font-bold text-slate-800 dark:text-white outline-none shadow-sm min-h-[40px]"
              />
            </div>

            {/* Tax */}
            {taxSetting && taxSetting.isActive && (
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Pajak ({taxSetting.taxName} {taxSetting.percentage}%)</span>
                <span className="font-semibold text-slate-850 dark:text-slate-300">{formatCurrency(getTaxAmount())}</span>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
              <span>Total Tagihan</span>
              <span className="text-blue-600 dark:text-blue-400 text-base">{formatCurrency(getGrandTotal())}</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setCheckoutMethod('CASH')}
              className={`p-3 rounded-xl border font-bold flex items-center gap-1.5 justify-center cursor-pointer transition-all min-h-[48px] ${
                checkoutMethod === 'CASH'
                  ? 'border-blue-500 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 shadow-sm'
              }`}
            >
              <Coins className="h-4 w-4" />
              <span>Tunai / CASH</span>
            </button>
            <button
              onClick={() => setCheckoutMethod('QRIS')}
              className={`p-3 rounded-xl border font-bold flex items-center gap-1.5 justify-center cursor-pointer transition-all min-h-[48px] ${
                checkoutMethod === 'QRIS'
                  ? 'border-blue-500 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 shadow-sm'
              }`}
            >
              <QrCode className="h-4 w-4" />
              <span>QRIS Midtrans</span>
            </button>
          </div>

          {/* Submit Checkout Button */}
          <Button
            variant="primary"
            className="w-full font-black tracking-wide uppercase py-3 shadow-lg shadow-blue-600/20 min-h-[48px] text-xs sm:text-sm"
            disabled={cart.length === 0}
            onClick={handleOpenCheckoutWizard}
            isLoading={isCheckoutLoading}
          >
            Bayar & Cetak Struk
          </Button>
        </div>
      </section>

      {/* Floating Sticky Bottom Bar for Mobile Devices */}
      {cart.length > 0 && !isMobileCartOpen && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between shadow-2xl animate-fade-in">
          <button 
            onClick={() => setIsMobileCartOpen(true)}
            className="flex items-center gap-3 text-left"
          >
            <div className="relative bg-blue-600 p-2.5 rounded-xl text-white shadow-md">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                {getItemCount()}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total POS</span>
              <span className="block text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                {formatCurrency(getGrandTotal())}
              </span>
            </div>
          </button>

          <Button
            variant="primary"
            className="font-black text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-1.5 min-h-[44px]"
            onClick={() => setIsMobileCartOpen(true)}
          >
            <span>Lihat Keranjang</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* CHECKOUT WIZARD DIALOG MODAL */}
      <Dialog
        isOpen={isCheckoutWizardOpen}
        onClose={() => {
          if (wizardStep !== 'QRIS_WAIT' && wizardStep !== 'RECEIPT') {
            setIsCheckoutWizardOpen(false);
          }
        }}
        title={
          wizardStep === 'ORDER_INFO' 
            ? 'Informasi Pesanan' 
            : wizardStep === 'PREVIEW_PAYMENT' 
            ? 'Review & Metode Pembayaran' 
            : wizardStep === 'QRIS_WAIT' 
            ? 'Menunggu Pembayaran' 
            : 'Transaksi Berhasil!'
        }
        description={
          wizardStep === 'ORDER_INFO' 
            ? 'Masukkan informasi pelanggan dan detail pesanan' 
            : wizardStep === 'PREVIEW_PAYMENT' 
            ? 'Silakan tinjau rincian struk dan pilih metode pembayaran' 
            : wizardStep === 'QRIS_WAIT' 
            ? 'Scan kode QRIS menggunakan e-wallet untuk menyelesaikan pembayaran' 
            : 'Pembayaran terverifikasi lunas, struk siap dicetak'
        }
        maxWidth={wizardStep === 'RECEIPT' ? 'receipt' : 'md'}
      >
        {/* Progress Bar (Only show if not in receipt step) */}
        {wizardStep !== 'RECEIPT' && (
          <div className="flex items-center justify-between mb-6 px-1 text-slate-400 dark:text-slate-500">
            <div className={`flex items-center gap-1.5 text-[11px] font-extrabold ${wizardStep === 'ORDER_INFO' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${wizardStep === 'ORDER_INFO' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>1</span>
              <span>Info Pesanan</span>
            </div>
            <div className="h-[2px] flex-1 bg-slate-200 dark:bg-slate-800 mx-2" />
            <div className={`flex items-center gap-1.5 text-[11px] font-extrabold ${wizardStep === 'PREVIEW_PAYMENT' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${wizardStep === 'PREVIEW_PAYMENT' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>2</span>
              <span>Review Struk</span>
            </div>
            <div className="h-[2px] flex-1 bg-slate-200 dark:bg-slate-800 mx-2" />
            <div className={`flex items-center gap-1.5 text-[11px] font-extrabold ${wizardStep === 'QRIS_WAIT' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${wizardStep === 'QRIS_WAIT' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>3</span>
              <span>Pembayaran</span>
            </div>
          </div>
        )}

        {/* STEP 1: ORDER INFO FORM */}
        {wizardStep === 'ORDER_INFO' && (
          <OrderInfoFormWrapper 
            onSubmit={(values) => {
              setOrderInfo(values);
              setWizardStep('PREVIEW_PAYMENT');
            }} 
            onClose={() => setIsCheckoutWizardOpen(false)}
            user={user}
            activeShift={activeShift}
          />
        )}

        {/* STEP 2: PREVIEW PAYMENT */}
        {wizardStep === 'PREVIEW_PAYMENT' && orderInfo && (
          <div className="flex flex-col gap-5">
            {/* Struk Preview Area */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col font-mono text-[10px] leading-relaxed text-slate-650 dark:text-slate-350 max-h-[280px] overflow-y-auto shadow-inner">
              <div className="text-center flex flex-col gap-0.5 border-b border-dashed border-slate-300 dark:border-slate-800 pb-2">
                <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  {(user as any)?.storeName || 'KasirMu Outlet'}
                </span>
                <span className="text-[9px] text-slate-500">Preview Struk POS</span>
              </div>

              <div className="flex flex-col gap-1.5 py-2.5 border-b border-dashed border-slate-300 dark:border-slate-800 text-slate-500">
                <div className="flex justify-between">
                  <span>Invoice :</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">INV-YYYYMMDD-XXXX (Auto)</span>
                </div>
                <div className="flex justify-between">
                  <span>Antrian :</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">AXXX (Auto)</span>
                </div>
                {orderInfo.customerName && (
                  <div className="flex justify-between">
                    <span>Nama :</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{orderInfo.customerName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Jenis Pesanan :</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">{orderInfo.orderType === 'DINE_IN' ? 'Dine In' : 'Take Away'}</span>
                </div>
                {orderInfo.orderType === 'DINE_IN' && orderInfo.tableNumber && (
                  <div className="flex justify-between">
                    <span>Meja :</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{orderInfo.tableNumber}</span>
                  </div>
                )}
                {orderInfo.customerPhone && (
                  <div className="flex justify-between">
                    <span>No Telepon :</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{orderInfo.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Kasir :</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{user?.name}</span>
                </div>
              </div>

              {/* Items */}
              <div className="py-2.5 border-b border-dashed border-slate-300 dark:border-slate-800 flex flex-col gap-1">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex justify-between items-start text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="block text-slate-800 dark:text-white font-bold">{item.product.name}</span>
                      <span className="block text-[8px] mt-0.5">{item.quantity}x @{formatCurrency(Number(item.product.price))}</span>
                    </div>
                    <span className="font-bold text-slate-800 dark:text-white shrink-0">
                      {formatCurrency(Number(item.product.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Math */}
              <div className="py-2 flex flex-col gap-1 text-slate-655 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(getSubtotal())}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Diskon</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                {taxSetting && taxSetting.isActive && (
                  <div className="flex justify-between">
                    <span>Pajak ({taxSetting.taxName} {taxSetting.percentage}%) :</span>
                    <span>{formatCurrency(getTaxAmount())}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 dark:text-white text-xs pt-1.5 border-t border-dotted border-slate-300 dark:border-slate-800">
                  <span>GRAND TOTAL</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {formatCurrency(getGrandTotal())}
                  </span>
                </div>
              </div>
            </div>

            {/* Selector metode pembayaran */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Pilih Metode Pembayaran</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCheckoutMethod('CASH')}
                  className={`p-3.5 rounded-xl border font-bold flex flex-col items-center gap-1.5 justify-center cursor-pointer transition-all ${
                    checkoutMethod === 'CASH'
                      ? 'border-blue-500 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 shadow-sm'
                  }`}
                >
                  <Coins className="h-5 w-5" />
                  <span>Tunai / CASH</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutMethod('QRIS')}
                  className={`p-3.5 rounded-xl border font-bold flex flex-col items-center gap-1.5 justify-center cursor-pointer transition-all ${
                    checkoutMethod === 'QRIS'
                      ? 'border-blue-500 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 shadow-sm'
                  }`}
                >
                  <QrCode className="h-5 w-5" />
                  <span>QRIS Midtrans</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setWizardStep('ORDER_INFO')}
                disabled={isCheckoutLoading}
              >
                Kembali
              </Button>
              <Button
                variant="primary"
                type="button"
                className="font-extrabold uppercase"
                onClick={() => handleCheckoutSubmit(checkoutMethod)}
                isLoading={isCheckoutLoading}
              >
                Proses Pembayaran
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: QRIS WAIT */}
        {wizardStep === 'QRIS_WAIT' && checkoutResponse && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">JUMLAH TAGIHAN (QRIS)</span>
              <span className="block text-2xl font-black text-blue-500 mt-1">
                {formatCurrency(checkoutResponse.payment?.grossAmount || checkoutResponse.transaction.total)}
              </span>
            </div>

            {/* Snap Payment Interface Container or Fallback QR Code */}
            {hasPaymentMethodError ? (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-xl text-xs font-semibold text-center max-w-[320px] mx-auto flex flex-col gap-2">
                <span>Merchant belum memiliki metode pembayaran QRIS yang aktif.</span>
                <span className="text-[10px] text-slate-500">Silakan hubungi administrator/owner untuk mengaktifkan metode QRIS di Dashboard Midtrans Sandbox Anda.</span>
              </div>
            ) : (checkoutResponse.transaction as any)?.snapToken && !(checkoutResponse.transaction as any).snapToken.startsWith('mock-') ? (
              <div 
                id="snap-container" 
                className="w-full min-h-[300px] bg-white rounded-xl border border-slate-200 shadow-inner flex items-center justify-center p-2"
              />
            ) : (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-center items-center shadow-md">
                <img 
                  src={checkoutResponse.payment?.qrCodeUrl || ''} 
                  alt="QRIS Code" 
                  className="w-56 h-56 object-contain"
                />
              </div>
            )}

            <div className="flex flex-col gap-1 text-slate-400 text-xs w-full">
              <div className="flex items-center gap-1.5 justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-extrabold text-emerald-500 animate-pulse">Menunggu pembayaran customer...</span>
              </div>
              {!hasPaymentMethodError && (checkoutResponse.transaction as any)?.snapToken && !(checkoutResponse.transaction as any).snapToken.startsWith('mock-') && (
                <button 
                  type="button"
                  onClick={() => setHasPaymentMethodError(true)}
                  className="text-[9px] text-amber-500 dark:text-amber-400 hover:underline font-semibold mt-1 block cursor-pointer"
                >
                  Metode pembayaran kosong / tidak muncul?
                </button>
              )}
              <span className="text-[10px] text-slate-505 mt-1 max-w-[280px] mx-auto">
                Sistem akan otomatis menutup screen ini ketika transaksi lunas terverifikasi webhook.
              </span>
            </div>

            {/* Cancel Button */}
            <div className="w-full">
              <Button
                variant="outline"
                className="w-full border-red-200 text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 hover:text-red-600 dark:border-red-900/30"
                onClick={async () => {
                  if (confirm('Apakah Anda yakin ingin membatalkan transaksi QRIS ini?')) {
                    try {
                      setIsCheckoutLoading(true);
                      await api.post('/payment/cancel', { transactionId: checkoutResponse.transaction.id });
                      setWizardStep('PREVIEW_PAYMENT');
                    } catch (e: any) {
                      alert(e.message || 'Gagal membatalkan transaksi');
                    } finally {
                      setIsCheckoutLoading(false);
                    }
                  }
                }}
                disabled={isCheckoutLoading}
              >
                Batalkan Pembayaran
              </Button>
            </div>

            {/* Simulator Pay Trigger for cashier screen developer convenience */}
            <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 w-full flex flex-col gap-2 text-xs mt-2">
              <span className="text-[10px] font-black text-slate-500 uppercase block">SIMULATOR LUNAS</span>
              <Button
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-700 font-bold w-full flex items-center justify-center gap-1"
                onClick={async () => {
                  try {
                    await api.post('/payments/simulate-callback', {
                      transactionNumber: checkoutResponse.transaction.transactionNumber,
                      status: 'settlement'
                    });
                  } catch (e) {
                    console.error(e);
                  }
                }}
                disabled={isCheckoutLoading}
              >
                <Sparkles className="h-4 w-4" /> Simulasikan Callback Selesai
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: RECEIPT */}
        {wizardStep === 'RECEIPT' && checkoutResponse?.transaction && (() => {
          const receiptStore = checkoutResponse.transaction.store || (stores || []).find((s) => s.id === currentStoreId) || (stores || [])[0];
          return (
          <div className="flex flex-col gap-5">
            {/* The Print Container */}
            <div 
              id="print-receipt-modal" 
              className="bg-slate-900 border border-slate-850 p-4 rounded-lg flex flex-col font-mono text-[10px] leading-relaxed text-slate-300 shadow-md"
            >
              {/* Header */}
              <div className="text-center flex flex-col gap-0.5 border-b border-dashed border-slate-800 pb-3">
                {/* Logo */}
                {receiptStore?.logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={receiptStore.logo} alt="Logo Struk" className="w-12 h-12 object-contain mx-auto mb-1" />
                ) : (
                  <div className="bg-blue-600 text-white font-black text-[9px] px-2 py-0.5 rounded mx-auto mb-1 w-fit">
                    KasirMu POS
                  </div>
                )}

                <span className="text-[11px] font-extrabold text-white uppercase tracking-wider block">
                  {receiptStore?.name || (user as any)?.storeName || 'KasirMu Outlet'}
                </span>

                {receiptStore?.address && (
                  <span className="text-[9px] text-slate-400 block">{receiptStore.address}</span>
                )}

                {(receiptStore?.district || receiptStore?.city || receiptStore?.province || receiptStore?.postalCode) && (
                  <span className="text-[9px] text-slate-400 block">
                    {[receiptStore.district, receiptStore.city, receiptStore.province, receiptStore.postalCode].filter(Boolean).join(', ')}
                  </span>
                )}

                {receiptStore?.phone && (
                  <span className="text-[9px] font-bold text-slate-300 block mt-0.5">
                    Telp : {receiptStore.phone}
                  </span>
                )}

                <span className="text-xs font-black text-white uppercase tracking-wider block mt-1">
                  ==================================
                </span>
              </div>

              {/* Meta */}
              <div className="flex flex-col gap-1 py-2.5 border-b border-dashed border-slate-800 text-slate-400">
                <div className="flex justify-between">
                  <span>Invoice :</span>
                  <span className="font-semibold text-white">
                    {checkoutResponse.transaction.invoiceNumber || checkoutResponse.transaction.transactionNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Antrian :</span>
                  <span className="font-black text-blue-400 text-xs">
                    {checkoutResponse.transaction.queueNumber || 'AXXX'}
                  </span>
                </div>
                {orderInfo?.customerName && (
                  <div className="flex justify-between">
                    <span>Nama :</span>
                    <span className="font-semibold text-white">{orderInfo.customerName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Jenis Pesanan :</span>
                  <span className="font-semibold text-white uppercase">{orderInfo?.orderType === 'DINE_IN' ? 'Dine In' : 'Take Away'}</span>
                </div>
                {orderInfo?.orderType === 'DINE_IN' && orderInfo?.tableNumber && (
                  <div className="flex justify-between">
                    <span>Meja :</span>
                    <span className="font-semibold text-white">{orderInfo.tableNumber}</span>
                  </div>
                )}
                {orderInfo?.customerPhone && (
                  <div className="flex justify-between">
                    <span>No Telp :</span>
                    <span className="font-semibold text-white">{orderInfo.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Kasir :</span>
                  <span className="font-semibold text-white">{user?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tanggal :</span>
                  <span>{new Date(checkoutResponse.transaction.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Jam :</span>
                  <span>{new Date(checkoutResponse.transaction.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Items */}
              <div className="py-2.5 border-b border-dashed border-slate-800 flex flex-col gap-1.5">
                <div className="text-slate-500 font-bold block mb-0.5">Produk</div>
                {cart.map((item) => (
                  <div key={item.product.id} className="flex justify-between items-start text-slate-400">
                    <div className="min-w-0 pr-2">
                      <span className="block text-white truncate font-bold">{item.product.name}</span>
                      <span className="block text-[8px] mt-0.5">{item.quantity}x @{formatCurrency(Number(item.product.price))}</span>
                    </div>
                    <span className="font-bold text-white shrink-0">
                      {formatCurrency(Number(item.product.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Calculation */}
              <div className="py-2.5 flex flex-col gap-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(getSubtotal())}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Diskon</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                {checkoutResponse.transaction.tax !== undefined && Number(checkoutResponse.transaction.tax) > 0 && (
                  <div className="flex justify-between">
                    <span>Pajak :</span>
                    <span>{formatCurrency(Number(checkoutResponse.transaction.tax))}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-white text-xs pt-1.5 border-t border-dotted border-slate-800">
                  <span>Total :</span>
                  <span className="text-blue-400">{formatCurrency(Number(checkoutResponse.transaction.total))}</span>
                </div>
                <div className="flex justify-between text-[8px] uppercase font-bold text-slate-500 mt-1">
                  <span>Pembayaran :</span>
                  <span>{checkoutResponse.transaction.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-[8px] uppercase font-bold text-slate-500">
                  <span>Status :</span>
                  <span className="text-emerald-400 font-extrabold">LUNAS</span>
                </div>
              </div>

              {/* QR Code Section */}
              {qrCodeDataUrl && (
                <div className="py-3 border-t border-dashed border-slate-800 flex flex-col items-center gap-1.5">
                  <span className="text-[7px] text-slate-500 uppercase tracking-widest">SCAN DETAIL TRANSAKSI (OWNER)</span>
                  <div className="bg-white p-1 rounded mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCodeDataUrl} alt="Transaction QR" className="w-20 h-20 mx-auto" />
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="text-center pt-3 border-t border-dashed border-slate-800/80 mt-1 text-[8px] text-slate-400 flex flex-col gap-1">
                <span className="font-bold text-white block">
                  {receiptStore?.footerNote || 'Terima kasih telah berbelanja'}
                </span>

                {receiptStore?.whatsapp && (
                  <span className="block">
                    WhatsApp : <strong className="text-white">{receiptStore.whatsapp}</strong>
                  </span>
                )}
                {receiptStore?.instagram && (
                  <span className="block">
                    Instagram : <strong className="text-white">{receiptStore.instagram}</strong>
                  </span>
                )}
                {receiptStore?.website && (
                  <span className="block">
                    Website : <strong className="text-white">{receiptStore.website}</strong>
                  </span>
                )}

                <div className="mt-2 pt-2 border-t border-dashed border-slate-800 text-[7.5px] text-slate-500 tracking-widest uppercase">
                  Powered by KasirMu POS
                </div>
                <span className="block text-[7px] text-slate-600">==================================</span>
              </div>
            </div>
          

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2.5 justify-end">
              <Button
                variant="secondary"
                size="sm"
                className="font-bold flex items-center gap-1 text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
                onClick={() => triggerAutoPrintReceipt(checkoutResponse)}
              >
                <Printer className="h-3.5 w-3.5 text-blue-400" />
                <span>Cetak Thermal (Bluetooth)</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="font-bold flex items-center gap-1"
                onClick={() => {
                  const printContents = document.getElementById('print-receipt-modal')?.innerHTML;
                  if (printContents) {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Print Receipt</title>
                            <style>
                              body { font-family: monospace; font-size: 10px; color: black; background: white; padding: 10px; width: 280px; }
                              .text-center { text-align: center; }
                              .flex { display: flex; }
                              .flex-col { flex-direction: column; }
                              .justify-between { justify-content: space-between; }
                              .border-b { border-bottom: 1px dashed black; }
                              .border-t { border-top: 1px dashed black; }
                              .pb-3 { padding-bottom: 8px; }
                              .pt-3 { padding-top: 8px; }
                              .py-2.5 { padding-top: 6px; padding-bottom: 6px; }
                              .py-3 { padding-top: 8px; padding-bottom: 8px; }
                              .font-semibold { font-weight: 600; }
                              .font-bold { font-weight: 700; }
                              .font-extrabold { font-weight: 800; }
                              .font-black { font-weight: 900; }
                              .text-xs { font-size: 11px; }
                              .text-white, .text-slate-300, .text-slate-400, .text-slate-500, .text-slate-600, .text-blue-400, .text-emerald-400 { color: black !important; }
                              .mx-auto { margin-left: auto; margin-right: auto; }
                              .block { display: block; }
                              .mt-1 { margin-top: 4px; }
                              .mt-0.5 { margin-top: 2px; }
                              img { display: block; margin: 4px auto; max-width: 60px; max-height: 60px; }
                            </style>

                          </head>
                          <body>
                            ${printContents}
                            <script>
                              window.onload = function() { window.print(); window.close(); }
                            </script>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  }
                }}
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Struk</span>
              </Button>
              
              <Button
                variant="primary"
                size="sm"
                className="font-bold flex items-center gap-1"
                onClick={handleResetCheckout}
              >
                <Check className="h-3.5 w-3.5" />
                <span>Selesai (OK)</span>
              </Button>
            </div>
          </div>
          );
        })()}
      </Dialog>
    </div>
  );
}
