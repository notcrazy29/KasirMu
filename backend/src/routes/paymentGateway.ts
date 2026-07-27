import { Router } from 'express';
import {
  saveGatewaySettings,
  getGatewaySettings,
  getGatewaySettingsSuperAdmin,
  getGatewayClientKey,
} from '../controllers/paymentGateway';
import { authenticate, authorize } from '../middlewares/auth';
import { checkFeature } from '../middlewares/subscription';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Owner: save/test connection and view settings
// SPEC: Only PRO subscribers can configure payment gateway
router.post(
  '/stores/:storeId/payment-gateway',
  authorize(['OWNER']),
  checkFeature('canUseMidtrans'),
  saveGatewaySettings,
);
router.get(
  '/stores/:storeId/payment-gateway',
  authorize(['OWNER']),
  checkFeature('canUseMidtrans'),
  getGatewaySettings,
);

// Cashier/POS: read-only client key endpoint (safe — no server key exposed)
// No subscription check needed — cashier needs this to process payments
router.get('/stores/:storeId/payment-gateway/client-key', getGatewayClientKey);

// Super Admin: status only — no keys
router.get('/superadmin/stores/:storeId/payment-gateway', authorize(['SUPER_ADMIN']), getGatewaySettingsSuperAdmin);

export default router;
