/**
 * Native ESC/POS Binary Encoder for Bluetooth Thermal Printers
 * Supports 58mm (32 characters/line) and 80mm (48 characters/line) paper
 */

export interface ReceiptStoreInfo {
  name: string;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  website?: string | null;
  footerNote?: string | null;
  logo?: string | null;
}

export interface ReceiptItem {
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ReceiptData {
  transactionNumber: string;
  invoiceNumber?: string | null;
  queueNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  tableNumber?: string | null;
  orderType?: string | null; // DINE_IN, TAKE_AWAY
  cashierName?: string | null;
  createdAt: string | Date;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  store: ReceiptStoreInfo;
}

class EscPosEncoder {
  private buffer: number[] = [];

  // ESC/POS Command Constants
  private static readonly ESC = 0x1b;
  private static readonly GS = 0x1d;
  private static readonly LF = 0x0a;

  constructor() {
    this.init();
  }

  /**
   * Reset printer settings to default
   */
  public init(): this {
    this.buffer.push(EscPosEncoder.ESC, 0x40); // ESC @
    return this;
  }

  /**
   * Set text alignment: 'LEFT' | 'CENTER' | 'RIGHT'
   */
  public align(align: 'LEFT' | 'CENTER' | 'RIGHT'): this {
    let value = 0;
    if (align === 'CENTER') value = 1;
    if (align === 'RIGHT') value = 2;
    this.buffer.push(EscPosEncoder.ESC, 0x61, value); // ESC a n
    return this;
  }

  /**
   * Enable or disable bold mode
   */
  public bold(enable: boolean = true): this {
    this.buffer.push(EscPosEncoder.ESC, 0x45, enable ? 1 : 0); // ESC E n
    return this;
  }

  /**
   * Set text size
   * width: 1-8, height: 1-8
   */
  public size(width: number = 1, height: number = 1): this {
    const n = ((width - 1) & 0x0f) << 4 | ((height - 1) & 0x0f);
    this.buffer.push(EscPosEncoder.GS, 0x21, n); // GS ! n
    return this;
  }

  /**
   * Add raw text with optional encoding (convert to UTF-8 bytes)
   */
  public text(str: string): this {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  /**
   * Add line break
   */
  public newline(count: number = 1): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(EscPosEncoder.LF);
    }
    return this;
  }

  /**
   * Add centered divider line
   */
  public divider(char: string = '-', cols: number = 32): this {
    this.align('CENTER');
    this.text(char.repeat(cols));
    this.newline();
    return this;
  }

  /**
   * Add a line with left text and right text spaced out evenly
   */
  public row(left: string, right: string, cols: number = 32): this {
    this.align('LEFT');
    const spaceNeeded = cols - left.length - right.length;
    if (spaceNeeded > 0) {
      this.text(left + ' '.repeat(spaceNeeded) + right);
    } else {
      // If text is too long, wrap or truncate gracefully
      const maxLeftWidth = cols - right.length - 1;
      const truncatedLeft = left.length > maxLeftWidth ? left.substring(0, maxLeftWidth) : left;
      const padding = Math.max(1, cols - truncatedLeft.length - right.length);
      this.text(truncatedLeft + ' '.repeat(padding) + right);
    }
    this.newline();
    return this;
  }

  /**
   * Cut paper command
   */
  public cut(): this {
    this.newline(3);
    this.buffer.push(EscPosEncoder.GS, 0x56, 0x41, 0x00); // GS V A 0
    return this;
  }

  /**
   * Return output buffer as Uint8Array
   */
  public encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Format currency IDR
 */
function formatRupiah(amount: number): string {
  return 'Rp' + amount.toLocaleString('id-ID');
}

/**
 * Format date & time nicely
 */
function formatDate(dateInput: string | Date): { dateStr: string; timeStr: string } {
  const d = new Date(dateInput);
  const dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return { dateStr, timeStr };
}

/**
 * Generate native ESC/POS Uint8Array for Test Print ("Tes Cetak")
 */
export function generateTestReceipt(): Uint8Array {
  const encoder = new EscPosEncoder();
  const { dateStr, timeStr } = formatDate(new Date());

  encoder
    .init()
    .align('CENTER')
    .divider('=', 32)
    .bold(true)
    .size(2, 2)
    .text('SMARTPOS')
    .newline()
    .size(1, 1)
    .text('Printer Berhasil')
    .newline()
    .bold(false)
    .text(`Tanggal: ${dateStr}`)
    .newline()
    .text(`Jam: ${timeStr}`)
    .newline()
    .divider('=', 32)
    .cut();

  return encoder.encode();
}

/**
 * Generate native ESC/POS Uint8Array for full Store Receipt
 */
export function generateReceipt(data: ReceiptData, cols: number = 32): Uint8Array {
  const encoder = new EscPosEncoder();
  const store = data.store || { name: 'KasirMu POS' };
  const { dateStr, timeStr } = formatDate(data.createdAt || new Date());

  encoder.init();

  // Header - Store Name
  encoder
    .align('CENTER')
    .bold(true)
    .size(2, 1)
    .text(store.name || 'KasirMu POS')
    .newline()
    .size(1, 1)
    .bold(false);

  // Address
  if (store.address) {
    let fullAddr = store.address;
    if (store.city) fullAddr += `, ${store.city}`;
    encoder.text(fullAddr).newline();
  }

  // Phone
  if (store.phone || store.whatsapp) {
    encoder.text(`Telp/WA: ${store.phone || store.whatsapp}`).newline();
  }

  encoder.divider('=', cols);

  // Invoice & Order Meta
  const invNo = data.invoiceNumber || data.transactionNumber;
  encoder.row('Invoice:', invNo, cols);

  if (data.queueNumber) {
    encoder.row('Antrian:', data.queueNumber, cols);
  }

  encoder.row('Tanggal:', `${dateStr} ${timeStr}`, cols);

  if (data.cashierName) {
    encoder.row('Kasir:', data.cashierName, cols);
  }

  if (data.orderType) {
    const typeLabel = data.orderType === 'DINE_IN' ? 'Dine In' : 'Take Away';
    encoder.row('Jenis Pesanan:', typeLabel, cols);
  }

  if (data.orderType === 'DINE_IN' && data.tableNumber) {
    encoder.row('Meja:', data.tableNumber, cols);
  }

  if (data.customerName) {
    encoder.row('Pelanggan:', data.customerName, cols);
  }

  encoder.divider('-', cols);

  // Items List
  data.items.forEach((item) => {
    // Product Name line
    encoder.align('LEFT').bold(true).text(item.productName).newline();
    // Qty x Price = Total
    const qtyPriceStr = `${item.quantity}x ${formatRupiah(item.price)}`;
    const totalStr = formatRupiah(item.total);
    encoder.bold(false).row(`  ${qtyPriceStr}`, totalStr, cols);
  });

  encoder.divider('-', cols);

  // Summary (Subtotal, Tax, Discount, Grand Total)
  encoder.row('Subtotal:', formatRupiah(data.subtotal), cols);

  if (data.discount > 0) {
    encoder.row('Diskon:', `-${formatRupiah(data.discount)}`, cols);
  }

  if (data.tax > 0) {
    encoder.row('Pajak:', formatRupiah(data.tax), cols);
  }

  encoder.bold(true).row('GRAND TOTAL:', formatRupiah(data.total), cols).bold(false);

  encoder.divider('-', cols);

  // Payment Details
  encoder.row('Pembayaran:', data.paymentMethod, cols);
  encoder.row('Status:', data.paymentStatus || 'LUNAS', cols);

  encoder.divider('=', cols);

  // Footer Note
  encoder.align('CENTER');
  if (store.footerNote) {
    encoder.text(store.footerNote).newline();
  } else {
    encoder.text('Terima kasih telah berbelanja').newline();
  }

  if (store.whatsapp) {
    encoder.text(`WA: ${store.whatsapp}`).newline();
  }
  if (store.instagram) {
    encoder.text(`IG: ${store.instagram}`).newline();
  }
  if (store.website) {
    encoder.text(store.website).newline();
  }

  encoder
    .newline(1)
    .text('Powered by KasirMu POS')
    .newline()
    .cut();

  return encoder.encode();
}
