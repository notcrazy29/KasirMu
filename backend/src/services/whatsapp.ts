import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

class WhatsAppService {
  private sock: WASocket | null = null;
  private qrCodeDataUrl: string | null = null;
  private connectionStatus: 'disconnected' | 'qr_ready' | 'connecting' | 'connected' = 'disconnected';
  private authFolder = path.join(__dirname, '../../whatsapp-auth-state');

  constructor() {
    this.init();
  }

  public async init() {
    try {
      if (!fs.existsSync(this.authFolder)) {
        fs.mkdirSync(this.authFolder, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
      const { version } = await fetchLatestBaileysVersion();

      this.connectionStatus = 'connecting';
      console.log('[WhatsAppService] Initializing Baileys connection...');

      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        browser: ['KasirMu POS', 'Chrome', '1.0.0']
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.connectionStatus = 'qr_ready';
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr);
            console.log('[WhatsAppService] New QR Code generated. Open /api/auth/whatsapp/qr to scan.');
          } catch (err) {
            console.error('[WhatsAppService] Failed to generate QR data URL:', err);
          }
        }

        if (connection === 'open') {
          this.connectionStatus = 'connected';
          this.qrCodeDataUrl = null;
          console.log('====================================================');
          console.log('✅ [WhatsAppService] WhatsApp Connected Successfully!');
          console.log('====================================================');
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          this.connectionStatus = 'disconnected';
          console.log(`[WhatsAppService] Connection closed due to: ${lastDisconnect?.error}. Reconnecting: ${shouldReconnect}`);

          if (shouldReconnect) {
            setTimeout(() => this.init(), 5000);
          } else {
            console.log('[WhatsAppService] Logged out. Clearing session data...');
            if (fs.existsSync(this.authFolder)) {
              fs.rmSync(this.authFolder, { recursive: true, force: true });
            }
            setTimeout(() => this.init(), 5000);
          }
        }
      });
    } catch (error) {
      console.error('[WhatsAppService Init Error]', error);
      this.connectionStatus = 'disconnected';
    }
  }

  public formatJid(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    }
    if (!clean.includes('@s.whatsapp.net')) {
      clean = clean + '@s.whatsapp.net';
    }
    return clean;
  }

  public async sendOTP(phone: string, code: string): Promise<boolean> {
    if (this.connectionStatus !== 'connected' || !this.sock) {
      console.error(`[WhatsAppService] Cannot send OTP. Status: ${this.connectionStatus}`);
      return false;
    }

    try {
      const jid = this.formatJid(phone);
      const message = `[KasirMu] Kode OTP verifikasi Anda adalah *${code}*.\n\nBerlaku selama 5 menit. Jaga kerahasiaan kode ini dan jangan berikan kepada siapapun.`;
      
      await this.sock.sendMessage(jid, { text: message });
      console.log(`[WhatsAppService] OTP ${code} successfully sent via WhatsApp to ${phone}`);
      return true;
    } catch (error) {
      console.error(`[WhatsAppService] Failed to send OTP to ${phone}:`, error);
      return false;
    }
  }

  public getStatus() {
    return {
      status: this.connectionStatus,
      qrDataUrl: this.qrCodeDataUrl
    };
  }

  public getHtmlPage(): string {
    const { status, qrDataUrl } = this.getStatus();
    return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KasirMu - WhatsApp Gateway Status</title>
  <meta http-equiv="refresh" content="5">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #0f172a;
      color: #f8fafc;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      background-color: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 32px;
      max-width: 420px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    h2 { margin-top: 0; color: #38bdf8; }
    .badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .connected { background-color: #059669; color: #ecfdf5; }
    .qr_ready { background-color: #d97706; color: #fffbe completed; }
    .disconnected, .connecting { background-color: #dc2626; color: #fef2f2; }
    img { border-radius: 12px; background: white; padding: 12px; margin: 16px 0; max-width: 250px; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.5; }
    .refresh-hint { font-size: 12px; color: #64748b; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>KasirMu WhatsApp Gateway</h2>
    
    ${status === 'connected' ? `
      <div class="badge connected">🟢 TERHUBUNG (CONNECTED)</div>
      <p style="color: #34d399; font-size: 16px; font-weight: 600;">Sistem WhatsApp OTP Aktif & Siap Digunakan!</p>
      <p>Pesan OTP 6-digit akan otomatis terkirim ke WhatsApp pengguna secara real-time.</p>
    ` : status === 'qr_ready' && qrDataUrl ? `
      <div class="badge qr_ready">📲 PINTU UNTUK PAIRING</div>
      <p>Buka WhatsApp di HP Anda &gt; <b>Perangkat Tertaut</b> &gt; <b>Tautkan Perangkat</b> lalu scan QR Code berikut:</p>
      <img src="${qrDataUrl}" alt="WhatsApp QR Code" />
    ` : `
      <div class="badge disconnected">⏳ MENGHUBUNGKAN... (${status})</div>
      <p>Sedang menyiapkan koneksi WhatsApp Web. Halaman ini akan reload otomatis...</p>
    `}

    <div class="refresh-hint">Halaman ini otomatis reload setiap 5 detik.</div>
  </div>
</body>
</html>
    `;
  }
}

export const whatsappService = new WhatsAppService();
