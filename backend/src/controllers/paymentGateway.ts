import { Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/auth';
import { encrypt } from '../utils/crypto';
import { checkFeatureAccess } from '../services/subscription';
import midtransClient from 'midtrans-client';

// Helper to validate Midtrans credentials by querying transaction status of a dummy ID
const validateMidtransConnection = async (
  serverKey: string,
  clientKey: string,
  environment: 'SANDBOX' | 'PRODUCTION'
): Promise<boolean> => {
  const isProduction = environment === 'PRODUCTION';
  
  const core = new midtransClient.CoreApi({
    isProduction,
    serverKey,
    clientKey,
  });

  try {
    await (core as any).transaction.status('connection-test-dummy-id');
    return true;
  } catch (error: any) {
    // Midtrans API returns 404 if the Server Key is authenticated but transaction doesn't exist.
    // An invalid API key triggers 401 Unauthorized or 403 Forbidden.
    const statusCode = error.httpStatusCode?.toString();
    if (statusCode === '404' || error.message?.includes('404')) {
      return true;
    }
    console.error('[Midtrans Connection Test] Connection failed with status:', statusCode, error.message);
    return false;
  }
};

// Censor key helper
const censorKey = (key: string) => {
  if (!key) return '';
  if (key.length <= 15) return '***';
  return key.substring(0, 14) + '...';
};

// Save & Test Midtrans Gateway Settings
export const saveGatewaySettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const { merchantId, serverKey, clientKey, environment } = req.body;
    const ownerId = req.user?.id;

    if (!storeId) {
      return res.status(400).json({ message: 'Store ID is required' });
    }

    // Verify store ownership
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Tidak memiliki otorisasi untuk mengakses toko ini' });
    }

    // Handle Disconnect (if empty credentials provided)
    if (!serverKey || !clientKey) {
      await prisma.paymentGateway.deleteMany({ where: { storeId } });
      return res.json({
        message: 'Payment Gateway dinonaktifkan',
        status: 'DISCONNECTED'
      });
    }

    // Test connection
    const isConnected = await validateMidtransConnection(serverKey, clientKey, environment);
    if (!isConnected) {
      return res.status(400).json({
        message: 'Gagal terhubung ke Midtrans. Silakan periksa Server Key, Client Key, Merchant ID, dan Environment.'
      });
    }

    // Encrypt Server Key
    const encryptedServerKey = encrypt(serverKey);

    // Upsert Payment Gateway settings
    const gateway = await prisma.paymentGateway.upsert({
      where: { storeId },
      update: {
        merchantId: merchantId || null,
        serverKeyEncrypted: encryptedServerKey,
        clientKey: clientKey,
        environment: environment || 'SANDBOX',
        status: 'CONNECTED',
        connectedAt: new Date(),
      },
      create: {
        storeId,
        provider: 'MIDTRANS',
        merchantId: merchantId || null,
        serverKeyEncrypted: encryptedServerKey,
        clientKey: clientKey,
        environment: environment || 'SANDBOX',
        status: 'CONNECTED',
        connectedAt: new Date(),
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_PAYMENT_GATEWAY',
        actorId: ownerId || 'SYSTEM',
        targetId: storeId,
        description: `Owner configured Midtrans gateway for store ${store.name} in ${environment} environment.`
      }
    });

    return res.json({
      message: 'Koneksi berhasil dan kredensial disimpan',
      status: gateway.status,
      connectedAt: gateway.connectedAt
    });
  } catch (error) {
    next(error);
  }
};

// Get gateway settings (For OWNER view)
export const getGatewaySettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const ownerId = req.user?.id;

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Tidak memiliki otorisasi untuk mengakses toko ini' });
    }

    const gateway = await prisma.paymentGateway.findUnique({ where: { storeId } });

    if (!gateway) {
      return res.json({ status: 'DISCONNECTED', provider: 'MIDTRANS' });
    }

    return res.json({
      id: gateway.id,
      storeId: gateway.storeId,
      provider: gateway.provider,
      merchantId: gateway.merchantId,
      clientKey: censorKey(gateway.clientKey),
      environment: gateway.environment,
      status: gateway.status,
      connectedAt: gateway.connectedAt
    });
  } catch (error) {
    next(error);
  }
};

// Get gateway settings (For SUPER ADMIN view)
export const getGatewaySettingsSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;

    const gateway = await prisma.paymentGateway.findUnique({ where: { storeId } });

    if (!gateway) {
      return res.json({ status: 'DISCONNECTED', provider: 'MIDTRANS' });
    }

    return res.json({
      provider: gateway.provider,
      environment: gateway.environment,
      status: gateway.status,
      connectedAt: gateway.connectedAt
    });
  } catch (error) {
    next(error);
  }
};

// Get only client key + environment — safe to expose to POS frontend (no server key)
export const getGatewayClientKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { ownerId: true, midtransClientKey: true },
    });

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Verify if subscription allows Midtrans
    const featureAccess = await checkFeatureAccess(store.ownerId, 'canUseMidtrans');
    if (!featureAccess.allowed) {
      return res.json({
        clientKey: null,
        environment: 'SANDBOX',
        isConnected: false,
        message: 'Subscription plan does not support Midtrans integration.',
      });
    }

    const gateway = await prisma.paymentGateway.findUnique({ where: { storeId } });

    if (!gateway || gateway.status !== 'CONNECTED') {
      return res.json({
        clientKey: store.midtransClientKey || null,
        environment: 'SANDBOX',
        isConnected: false,
      });
    }

    return res.json({
      clientKey: gateway.clientKey,
      environment: gateway.environment,
      isConnected: true,
    });
  } catch (error) {
    next(error);
  }
};
