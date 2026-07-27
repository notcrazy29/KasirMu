import midtransClient from 'midtrans-client';
import crypto from 'crypto';
import { coreApi, snapApi, isMidtransConfigured } from '../config/midtrans';
import { decrypt } from '../utils/crypto';
import prisma from '../config/db';

export interface SnapResponse {
  snapToken: string;
  paymentUrl: string;
  midtransOrderId: string;
  clientKey: string;
  environment: string;
  midtransTransactionId?: string | null;
  qrString?: string | null;
  qrCodeUrl?: string | null;
}

// Resolve decrypted Midtrans credentials from PaymentGateway table or legacy store fields
export const resolveStoreCredentials = async (storeId: string): Promise<{
  serverKey: string | null;
  clientKey: string | null;
  isProduction: boolean;
  isConnected: boolean;
}> => {
  // 1. Try PaymentGateway table first (new multi-tenant approach)
  const gateway = await prisma.paymentGateway.findUnique({ where: { storeId } });
  if (gateway && gateway.status === 'CONNECTED') {
    try {
      const decryptedServerKey = decrypt(gateway.serverKeyEncrypted);
      return {
        serverKey: decryptedServerKey,
        clientKey: gateway.clientKey,
        isProduction: gateway.environment === 'PRODUCTION',
        isConnected: true,
      };
    } catch (err) {
      console.error('[Midtrans] Failed to decrypt server key from PaymentGateway:', err);
    }
  }

  // 2. Fallback: legacy store-level fields (for backward compatibility)
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { midtransServerKey: true, midtransClientKey: true },
  });

  const isLegacyValid = store?.midtransServerKey &&
    store.midtransServerKey.trim() !== '' &&
    store.midtransServerKey !== 'SB-Mid-server-placeholderkey';

  if (isLegacyValid) {
    return {
      serverKey: store!.midtransServerKey!,
      clientKey: store?.midtransClientKey || null,
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      isConnected: true,
    };
  }

  return {
    serverKey: null,
    clientKey: null,
    isProduction: false,
    isConnected: false,
  };
};

export const createSnapPayment = async (
  transactionNumber: string,
  totalAmount: number,
  storeId: string,
): Promise<SnapResponse> => {
  // Resolve credentials from PaymentGateway table
  const creds = await resolveStoreCredentials(storeId);

  // No credentials — fallback to offline simulator mode
  if (!creds.isConnected) {
    console.log('[Midtrans] No Payment Gateway configured — Using Offline Simulator Mode');
    const mockToken = `mock-snap-token-${Math.random().toString(36).substring(2, 15)}`;
    const mockQrData = `00020101021226380010ID.CO.QRIS.WWW0215ID10203040506070303UME51440014ID.CO.GOPAY.WWW02151234567890123455204581153033605802ID5912KASIRMU_MOCK6007JAKARTA6105123456207070303001`;
    const mockQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockQrData)}`;

    console.log('================== [MOCK MIDTRANS REQUEST] ==================');
    console.log(`Order ID    : ${transactionNumber}`);
    console.log(`Amount      : ${Math.round(totalAmount)}`);
    console.log('=============================================================');
    console.log('================== [MOCK MIDTRANS RESPONSE] =================');
    console.log(`Snap Token  : ${mockToken}`);
    console.log('=============================================================');

    return {
      snapToken: mockToken,
      paymentUrl: `https://app.sandbox.midtrans.com/snap/v2/vtweb/${mockToken}`,
      midtransOrderId: transactionNumber,
      clientKey: 'SB-Mid-client-placeholder',
      environment: 'SANDBOX',
      midtransTransactionId: `mock-midtrans-id-${Math.random().toString(36).substring(2, 11)}`,
      qrString: mockQrData,
      qrCodeUrl: mockQrUrl,
    };
  }

  // Real credentials available — use Midtrans Snap API
  try {
    const snapInstance = new midtransClient.Snap({
      isProduction: creds.isProduction,
      serverKey: creds.serverKey!,
      clientKey: creds.clientKey || '',
    });

    const parameter = {
      transaction_details: {
        order_id: transactionNumber,
        gross_amount: Math.round(totalAmount),
      },
      // Do NOT set enabled_payments — let merchant config determine active channels
    };

    console.log('==================== [MIDTRANS SNAP REQUEST] ====================');
    console.log(`Order ID    : ${transactionNumber}`);
    console.log(`Amount      : ${Math.round(totalAmount)}`);
    console.log(`Environment : ${creds.isProduction ? 'PRODUCTION' : 'SANDBOX'}`);
    console.log('=================================================================');

    const response = await snapInstance.createTransaction(parameter);

    console.log('==================== [MIDTRANS SNAP RESPONSE] ===================');
    console.log(`Snap Token  : ${response.token}`);
    console.log(`Redirect URL: ${response.redirect_url}`);
    console.log('=================================================================');

    return {
      snapToken: response.token,
      paymentUrl: response.redirect_url,
      midtransOrderId: transactionNumber,
      clientKey: creds.clientKey!,
      environment: creds.isProduction ? 'PRODUCTION' : 'SANDBOX',
      midtransTransactionId: null,
      qrString: null,
      qrCodeUrl: null,
    };
  } catch (error: any) {
    console.error('[Midtrans Snap] Error creating transaction:', error);
    throw new Error(error.message || 'Failed to create Midtrans Snap transaction');
  }
};

export const getTransactionStatus = async (
  orderId: string,
  storeId?: string | null,
) => {
  let serverKey: string | null = null;
  let clientKey: string | null = null;
  let isProduction = false;

  if (storeId) {
    const creds = await resolveStoreCredentials(storeId);
    serverKey = creds.serverKey;
    clientKey = creds.clientKey;
    isProduction = creds.isProduction;
  }

  const hasCredentials = !!serverKey;

  if (!hasCredentials && !isMidtransConfigured) {
    return {
      transaction_status: 'pending',
      fraud_status: 'accept',
      payment_type: 'qris',
    };
  }

  try {
    const apiInstance = hasCredentials
      ? new midtransClient.CoreApi({
          isProduction,
          serverKey: serverKey!,
          clientKey: clientKey || '',
        })
      : coreApi;

    return await (apiInstance as any).transaction.status(orderId);
  } catch (error: any) {
    console.error('[Midtrans] Error checking transaction status:', error);
    throw new Error(error.message || 'Failed to check transaction status with Midtrans');
  }
};

export const cancelTransaction = async (
  orderId: string,
  storeId?: string | null,
) => {
  let serverKey: string | null = null;
  let clientKey: string | null = null;
  let isProduction = false;

  if (storeId) {
    const creds = await resolveStoreCredentials(storeId);
    serverKey = creds.serverKey;
    clientKey = creds.clientKey;
    isProduction = creds.isProduction;
  }

  const hasCredentials = !!serverKey;

  if (!hasCredentials && !isMidtransConfigured) {
    return {
      status_code: '200',
      transaction_status: 'cancel',
    };
  }

  try {
    const apiInstance = hasCredentials
      ? new midtransClient.CoreApi({
          isProduction,
          serverKey: serverKey!,
          clientKey: clientKey || '',
        })
      : coreApi;

    return await (apiInstance as any).transaction.cancel(orderId);
  } catch (error: any) {
    console.error('[Midtrans] Error cancelling transaction:', error);
    throw new Error(error.message || 'Failed to cancel transaction with Midtrans');
  }
};

export const verifyWebhookSignature = (
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string,
  resolvedServerKey?: string | null
): boolean => {
  const hasKey = resolvedServerKey && resolvedServerKey.trim() !== '';

  if (!hasKey && !isMidtransConfigured) {
    // Bypass in simulator mode
    return true;
  }

  const serverKey = resolvedServerKey || process.env.MIDTRANS_SERVER_KEY || '';

  // Format: order_id + status_code + gross_amount + ServerKey
  const rawString = orderId + statusCode + grossAmount + serverKey;
  const hash = crypto.createHash('sha512').update(rawString).digest('hex');

  return hash === signatureKey;
};
