import midtransClient from 'midtrans-client';
import prisma from '../config/db';
import { encrypt, decrypt } from '../utils/crypto';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface PlatformGatewayConfig {
  merchantId?: string;
  merchantName?: string;
  serverKey: string;
  clientKey: string;
  environment: 'SANDBOX' | 'PRODUCTION';
}

export interface PlatformGatewayPublic {
  id: string;
  provider: string;
  merchantId: string | null;
  merchantName: string | null;
  clientKey: string;
  environment: string;
  status: string;
  connectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformCredentials {
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
  isConnected: boolean;
  merchantId: string | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Test Midtrans connection using provided credentials
// Returns true if server key is authenticated (even if transaction 404)
// ──────────────────────────────────────────────────────────────────────────────

export const testMidtransConnection = async (
  serverKey: string,
  clientKey: string,
  environment: 'SANDBOX' | 'PRODUCTION'
): Promise<{ connected: boolean; message: string }> => {
  const isProduction = environment === 'PRODUCTION';

  const core = new midtransClient.CoreApi({
    isProduction,
    serverKey,
    clientKey,
  });

  try {
    await (core as any).transaction.status('connection-test-kasirmu-platform');
    return { connected: true, message: 'Koneksi berhasil' };
  } catch (error: any) {
    const statusCode = error.httpStatusCode?.toString();
    // 404 = authenticated but transaction not found (which is expected)
    if (statusCode === '404' || error.message?.includes('404')) {
      return { connected: true, message: 'Koneksi berhasil' };
    }
    // 401/403 = authentication failed
    console.error('[Platform Gateway] Test connection failed:', statusCode, error.message);
    return {
      connected: false,
      message: `Gagal terhubung ke Midtrans (${statusCode || 'Error'}). Periksa Server Key, Client Key, dan Environment.`,
    };
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Save or update platform Midtrans configuration
// ──────────────────────────────────────────────────────────────────────────────

export const savePlatformGateway = async (
  config: PlatformGatewayConfig
): Promise<PlatformGatewayPublic> => {
  const encryptedServerKey = encrypt(config.serverKey);

  // Only one platform gateway should exist — use upsert on the first record
  const existing = await prisma.platformPaymentGateway.findFirst();

  let gateway;
  if (existing) {
    gateway = await prisma.platformPaymentGateway.update({
      where: { id: existing.id },
      data: {
        merchantId: config.merchantId || null,
        merchantName: config.merchantName || null,
        serverKeyEncrypted: encryptedServerKey,
        clientKey: config.clientKey,
        environment: config.environment,
        status: 'CONNECTED',
        connectedAt: new Date(),
      },
    });
  } else {
    gateway = await prisma.platformPaymentGateway.create({
      data: {
        provider: 'MIDTRANS',
        merchantId: config.merchantId || null,
        merchantName: config.merchantName || null,
        serverKeyEncrypted: encryptedServerKey,
        clientKey: config.clientKey,
        environment: config.environment,
        status: 'CONNECTED',
        connectedAt: new Date(),
      },
    });
  }

  // Return without exposing the server key
  return {
    id: gateway.id,
    provider: gateway.provider,
    merchantId: gateway.merchantId,
    merchantName: gateway.merchantName,
    clientKey: gateway.clientKey,
    environment: gateway.environment,
    status: gateway.status,
    connectedAt: gateway.connectedAt,
    createdAt: gateway.createdAt,
    updatedAt: gateway.updatedAt,
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Get platform gateway public info (never returns server key)
// ──────────────────────────────────────────────────────────────────────────────

export const getPlatformGateway = async (): Promise<PlatformGatewayPublic | null> => {
  const gateway = await prisma.platformPaymentGateway.findFirst();
  if (!gateway) return null;

  return {
    id: gateway.id,
    provider: gateway.provider,
    merchantId: gateway.merchantId,
    merchantName: gateway.merchantName,
    clientKey: gateway.clientKey,
    environment: gateway.environment,
    status: gateway.status,
    connectedAt: gateway.connectedAt,
    createdAt: gateway.createdAt,
    updatedAt: gateway.updatedAt,
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Resolve decrypted platform credentials (used by subscription checkout)
// ──────────────────────────────────────────────────────────────────────────────

export const resolvePlatformCredentials = async (): Promise<PlatformCredentials> => {
  const gateway = await prisma.platformPaymentGateway.findFirst({
    where: { status: 'CONNECTED' },
  });

  if (!gateway) {
    return {
      serverKey: '',
      clientKey: '',
      isProduction: false,
      isConnected: false,
      merchantId: null,
    };
  }

  try {
    const decryptedServerKey = decrypt(gateway.serverKeyEncrypted);
    return {
      serverKey: decryptedServerKey,
      clientKey: gateway.clientKey,
      isProduction: gateway.environment === 'PRODUCTION',
      isConnected: true,
      merchantId: gateway.merchantId,
    };
  } catch (err) {
    console.error('[Platform Gateway] Failed to decrypt server key:', err);
    return {
      serverKey: '',
      clientKey: '',
      isProduction: false,
      isConnected: false,
      merchantId: null,
    };
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Disconnect/Delete platform gateway
// ──────────────────────────────────────────────────────────────────────────────

export const disconnectPlatformGateway = async (): Promise<void> => {
  const existing = await prisma.platformPaymentGateway.findFirst();
  if (existing) {
    await prisma.platformPaymentGateway.delete({ where: { id: existing.id } });
  }
};
