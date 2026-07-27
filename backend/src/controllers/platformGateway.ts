import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { logAudit } from '../services/audit';
import {
  testMidtransConnection,
  savePlatformGateway,
  getPlatformGateway,
  disconnectPlatformGateway,
} from '../services/platformGateway';

// ──────────────────────────────────────────────────────────────────────────────
// GET /superadmin/payment-gateway/platform
// Returns current platform Midtrans config (no server key exposed)
// ──────────────────────────────────────────────────────────────────────────────

export const getPlatformGatewayConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gateway = await getPlatformGateway();

    if (!gateway) {
      return res.json({
        status: 'DISCONNECTED',
        provider: 'MIDTRANS',
        merchantId: null,
        merchantName: null,
        environment: 'SANDBOX',
        clientKey: null,
        connectedAt: null,
      });
    }

    return res.json(gateway);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /superadmin/payment-gateway/platform/test
// Test connection only — does not save credentials
// ──────────────────────────────────────────────────────────────────────────────

export const testPlatformGatewayConnection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverKey, clientKey, environment } = req.body;

    if (!serverKey || !clientKey || !environment) {
      return res.status(400).json({
        message: 'Server Key, Client Key, dan Environment wajib diisi',
      });
    }

    if (!['SANDBOX', 'PRODUCTION'].includes(environment)) {
      return res.status(400).json({ message: 'Environment harus SANDBOX atau PRODUCTION' });
    }

    const result = await testMidtransConnection(serverKey, clientKey, environment);

    return res.json({
      connected: result.connected,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /superadmin/payment-gateway/platform
// Save and activate platform Midtrans configuration
// ──────────────────────────────────────────────────────────────────────────────

export const savePlatformGatewayConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = req.user?.id || 'SYSTEM';
    const { merchantId, merchantName, serverKey, clientKey, environment } = req.body;

    if (!serverKey || !clientKey || !environment) {
      return res.status(400).json({
        message: 'Server Key, Client Key, dan Environment wajib diisi',
      });
    }

    if (!['SANDBOX', 'PRODUCTION'].includes(environment)) {
      return res.status(400).json({ message: 'Environment harus SANDBOX atau PRODUCTION' });
    }

    // Test connection before saving
    const testResult = await testMidtransConnection(serverKey, clientKey, environment);
    if (!testResult.connected) {
      return res.status(400).json({
        message: testResult.message,
        connected: false,
      });
    }

    const gateway = await savePlatformGateway({
      merchantId,
      merchantName,
      serverKey,
      clientKey,
      environment,
    });

    await logAudit({
      action: 'CONFIGURE_PLATFORM_MIDTRANS',
      actorId,
      targetId: gateway.id,
      description: `Super Admin configured Platform Midtrans Gateway. Merchant: ${merchantName || merchantId || 'N/A'}, Environment: ${environment}`,
    });

    return res.json({
      message: 'Konfigurasi Midtrans Platform berhasil disimpan dan terkoneksi',
      connected: true,
      gateway,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /superadmin/payment-gateway/platform
// Disconnect and remove platform gateway config
// ──────────────────────────────────────────────────────────────────────────────

export const deletePlatformGatewayConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = req.user?.id || 'SYSTEM';

    await disconnectPlatformGateway();

    await logAudit({
      action: 'DISCONNECT_PLATFORM_MIDTRANS',
      actorId,
      description: 'Super Admin disconnected Platform Midtrans Gateway',
    });

    return res.json({ message: 'Konfigurasi Midtrans Platform berhasil dihapus', status: 'DISCONNECTED' });
  } catch (error) {
    next(error);
  }
};
