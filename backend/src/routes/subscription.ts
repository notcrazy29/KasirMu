import { Router } from 'express';
import {
  getMySubscription,
  getSubscriptionPlans,
  checkoutSubscription,
  subscriptionWebhook,
  verifySubscriptionPayment,
  simulateSubscription,
  getAllSubscriptions,
  getSubscriptionRevenue,
  getSubscriptionMetrics,
  getAdminPlans,
  updateAdminPlan,
  claimTrialSubscription,
  getMyPaymentHistory,
} from '../controllers/subscription';
import { authenticate, authorize, superAdminGuard } from '../middlewares/auth';

const router = Router();

// ── Public routes (no auth required) ──
router.post('/webhook', subscriptionWebhook);
router.get('/public-plans', getSubscriptionPlans);

// ── Owner routes ──
router.get('/plans', authenticate, getSubscriptionPlans);
router.get('/my', authenticate, authorize(['OWNER']), getMySubscription);
router.get('/payment-history', authenticate, authorize(['OWNER']), getMyPaymentHistory);
router.post('/checkout', authenticate, authorize(['OWNER']), checkoutSubscription);
router.post('/verify-payment', authenticate, authorize(['OWNER']), verifySubscriptionPayment);
router.post('/simulate', authenticate, authorize(['OWNER']), simulateSubscription);
router.post('/trial/claim', authenticate, authorize(['OWNER']), claimTrialSubscription);

// ── Super Admin routes ──
router.get('/admin/all', authenticate, superAdminGuard, getAllSubscriptions);
router.get('/admin/revenue', authenticate, superAdminGuard, getSubscriptionRevenue);
router.get('/admin/metrics', authenticate, superAdminGuard, getSubscriptionMetrics);
router.get('/admin/plans', authenticate, superAdminGuard, getAdminPlans);
router.put('/admin/plans/:id', authenticate, superAdminGuard, updateAdminPlan);

export default router;
