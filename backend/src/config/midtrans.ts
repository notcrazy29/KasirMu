import midtransClient from 'midtrans-client';

const serverKey = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-placeholderkey';
const clientKey = process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-placeholderkey';
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

// Check if actual keys are set
export const isMidtransConfigured = 
  serverKey !== 'SB-Mid-server-placeholderkey' && 
  serverKey !== 'your_midtrans_server_key' &&
  serverKey.trim() !== '';

// Initialize Midtrans Core API
export const coreApi = new midtransClient.CoreApi({
  isProduction,
  serverKey,
  clientKey,
});

// Initialize Midtrans Snap API
export const snapApi = new midtransClient.Snap({
  isProduction,
  serverKey,
  clientKey,
});

export const clientKeyPublic = clientKey;
