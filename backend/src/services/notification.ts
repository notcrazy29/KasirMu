import fs from 'fs';
import path from 'path';

// Define the interface for SMS/OTP providers
export interface OTPProvider {
  name: string;
  sendOTP(phone: string, code: string): Promise<boolean>;
}

// 1. Mock Provider for local development
class MockProvider implements OTPProvider {
  name = 'mock';

  async sendOTP(phone: string, code: string): Promise<boolean> {
    const logMessage = `
=========================================
Time: ${new Date().toISOString()}
To (Phone): ${phone}
OTP Code: ${code}
Message: [KasirMu] Kode OTP registrasi Anda adalah ${code}. Valid selama 5 menit.
=========================================
`;
    console.log(`[OTP Mock] Sent OTP to: ${phone} | Code: ${code}`);

    try {
      const logsDir = path.join(__dirname, '../../logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      fs.appendFileSync(path.join(logsDir, 'otp.log'), logMessage);
    } catch (error) {
      console.error('Failed to write mock OTP log:', error);
    }

    return true;
  }
}

// 2. Twilio Provider
class TwilioProvider implements OTPProvider {
  name = 'twilio';

  async sendOTP(phone: string, code: string): Promise<boolean> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error('[Twilio OTP] Configuration missing');
      return false;
    }

    try {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: phone,
            From: fromNumber,
            Body: `[KasirMu] Kode OTP registrasi Anda adalah ${code}. Berlaku 5 menit. Jangan sebarkan kode ini.`,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Twilio OTP Error]', errorData);
        return false;
      }

      console.log(`[Twilio OTP] SMS sent successfully to ${phone}`);
      return true;
    } catch (error) {
      console.error('[Twilio OTP Exception]', error);
      return false;
    }
  }
}

// 3. Vonage Provider (formerly Nexmo)
class VonageProvider implements OTPProvider {
  name = 'vonage';

  async sendOTP(phone: string, code: string): Promise<boolean> {
    const apiKey = process.env.VONAGE_API_KEY;
    const apiSecret = process.env.VONAGE_API_SECRET;
    const from = process.env.VONAGE_BRAND_NAME || 'KasirMu';

    if (!apiKey || !apiSecret) {
      console.error('[Vonage OTP] Configuration missing');
      return false;
    }

    try {
      const response = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          to: phone,
          from,
          text: `[KasirMu] Kode OTP registrasi Anda adalah ${code}. Berlaku 5 menit.`,
        }),
      });

      const data = await response.json() as any;
      if (data.messages && data.messages[0] && data.messages[0].status === '0') {
        console.log(`[Vonage OTP] SMS sent successfully to ${phone}`);
        return true;
      } else {
        console.error('[Vonage OTP Error]', data);
        return false;
      }
    } catch (error) {
      console.error('[Vonage OTP Exception]', error);
      return false;
    }
  }
}

// 4. MessageBird Provider
class MessageBirdProvider implements OTPProvider {
  name = 'messagebird';

  async sendOTP(phone: string, code: string): Promise<boolean> {
    const apiKey = process.env.MESSAGEBIRD_API_KEY;
    const originator = process.env.MESSAGEBIRD_ORIGINATOR || 'KasirMu';

    if (!apiKey) {
      console.error('[MessageBird OTP] API Key missing');
      return false;
    }

    try {
      const response = await fetch('https://rest.messagebird.com/messages', {
        method: 'POST',
        headers: {
          'Authorization': `AccessKey ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: [phone],
          originator,
          body: `[KasirMu] Kode OTP registrasi Anda adalah ${code}. Berlaku 5 menit.`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[MessageBird OTP Error]', errorData);
        return false;
      }

      console.log(`[MessageBird OTP] SMS sent successfully to ${phone}`);
      return true;
    } catch (error) {
      console.error('[MessageBird OTP Exception]', error);
      return false;
    }
  }
}

// 5. Fonnte Provider (WhatsApp OTP)
class FonnteProvider implements OTPProvider {
  name = 'fonnte';

  async sendOTP(phone: string, code: string): Promise<boolean> {
    const token = process.env.FONNTE_TOKEN;

    if (!token) {
      console.error('[Fonnte OTP] Token missing');
      return false;
    }

    try {
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: phone,
          message: `[KasirMu] Kode OTP registrasi Anda adalah *${code}*. Berlaku selama 5 menit. Jangan berikan kode ini kepada siapapun termasuk pihak KasirMu.`,
        }),
      });

      const data = await response.json() as any;
      if (data.status === true) {
        console.log(`[Fonnte OTP] WhatsApp message sent successfully to ${phone}`);
        return true;
      } else {
        console.error('[Fonnte OTP Error]', data);
        return false;
      }
    } catch (error) {
      console.error('[Fonnte OTP Exception]', error);
      return false;
    }
  }
}

// 6. Mekari Qontak Provider
class MekariQontakProvider implements OTPProvider {
  name = 'mekari';

  async sendOTP(phone: string, code: string): Promise<boolean> {
    const token = process.env.MEKARI_QONTAK_TOKEN;
    const templateId = process.env.MEKARI_TEMPLATE_ID;
    const channelId = process.env.MEKARI_CHANNEL_ID;

    if (!token || !templateId || !channelId) {
      console.error('[Mekari Qontak] Configuration missing');
      return false;
    }

    try {
      const response = await fetch('https://api.qontak.com/api/open/v1/broadcasts/whatsapp/direct', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to_number: phone,
          to_name: phone,
          message_template_id: templateId,
          channel_integration_id: channelId,
          language: { code: 'id' },
          parameters: {
            body: [
              { key: '1', value: 'code', value_text: code }
            ]
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Mekari OTP Error]', errorData);
        return false;
      }

      console.log(`[Mekari OTP] OTP sent successfully to ${phone}`);
      return true;
    } catch (error) {
      console.error('[Mekari OTP Exception]', error);
      return false;
    }
  }
}

// 7. Komerce OTP Provider
class KomerceOTPProvider implements OTPProvider {
  name = 'komerce';

  async sendOTP(phone: string, code: string): Promise<boolean> {
    const token = process.env.KOMERCE_TOKEN;

    if (!token) {
      console.error('[Komerce OTP] Token missing');
      return false;
    }

    try {
      const response = await fetch('https://api.komerce.id/api/v1/otp/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          otp: code,
          message: `[KasirMu] Kode OTP registrasi Anda adalah ${code}. Berlaku 5 menit.`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Komerce OTP Error]', errorData);
        return false;
      }

      console.log(`[Komerce OTP] OTP sent successfully to ${phone}`);
      return true;
    } catch (error) {
      console.error('[Komerce OTP Exception]', error);
      return false;
    }
  }
}

// Notification Service manager class
export class NotificationService {
  private static providers: Record<string, OTPProvider> = {
    mock: new MockProvider(),
    twilio: new TwilioProvider(),
    vonage: new VonageProvider(),
    messagebird: new MessageBirdProvider(),
    fonnte: new FonnteProvider(),
    mekari: new MekariQontakProvider(),
    komerce: new KomerceOTPProvider(),
  };

  static async sendOTP(phone: string, code: string): Promise<boolean> {
    const selected = (process.env.OTP_PROVIDER || 'mock').toLowerCase();
    const provider = this.providers[selected] || this.providers.mock;

    console.log(`[NotificationService] Using provider: ${provider.name} to send OTP to ${phone}`);
    return provider.sendOTP(phone, code);
  }

  static async sendWhatsApp(phone: string, message: string): Promise<boolean> {
    console.log(`[NotificationService] Sending WhatsApp to ${phone}: ${message}`);
    
    const logMessage = `
=========================================
Time: ${new Date().toISOString()}
Type: WhatsApp Notification
To (Phone): ${phone}
Message: ${message}
=========================================
`;
    try {
      const logsDir = path.join(__dirname, '../../logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      fs.appendFileSync(path.join(logsDir, 'whatsapp.log'), logMessage);
    } catch (error) {
      console.error('Failed to write mock WhatsApp log:', error);
    }

    return true;
  }
}
