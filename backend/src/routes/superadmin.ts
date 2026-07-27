import { Router } from 'express';
import {
  getSuperAdminStats,
  getStores,
  createStore,
  updateStore,
  deleteStore,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getTransactions,
  approveUser,
  rejectUser,
  suspendUser,
  suspendStore,
  impersonateUser,
  getLogs,
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  getSubscriptionPayments,
  getMaintenanceMode,
  toggleMaintenanceMode,
  getOwnerSubscriptionsList,
  grantOwnerSubscription,
  revokeOwnerSubscription,
  createStoreSchemaSuper,
  updateStoreSchemaSuper,
  createUserSchemaSuper,
  updateUserSchemaSuper,
} from '../controllers/superadmin';
import {
  getPlatformGatewayConfig,
  savePlatformGatewayConfig,
  testPlatformGatewayConnection,
  deletePlatformGatewayConfig,
} from '../controllers/platformGateway';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';

const router = Router();

// Secure all super admin routes to only allow authenticated SUPER_ADMIN
router.use(authenticate);
router.use(authorize(['SUPER_ADMIN']));

// Statistics
router.get('/stats', getSuperAdminStats);

// Stores CRUD
router.get('/stores', getStores);
router.post('/stores', validateRequest(createStoreSchemaSuper), createStore);
router.put('/stores/:id', validateRequest(updateStoreSchemaSuper), updateStore);
router.delete('/stores/:id', deleteStore);
router.patch('/stores/suspend', suspendStore);

// Users CRUD
router.get('/users', getUsers);
router.post('/users', validateRequest(createUserSchemaSuper), createUser);
router.put('/users/:id', validateRequest(updateUserSchemaSuper), updateUser);
router.delete('/users/:id', deleteUser);
router.patch('/users/approve', approveUser);
router.patch('/users/reject', rejectUser);
router.patch('/users/suspend', suspendUser);

// Global Transactions
router.get('/transactions', getTransactions);

// Impersonation
router.post('/impersonate', impersonateUser);

// Activity Logs
router.get('/logs', getLogs);

// Subscription management
router.get('/subscriptions/plans', getSubscriptionPlans);
router.post('/subscriptions/plans', createSubscriptionPlan);
router.put('/subscriptions/plans/:id', updateSubscriptionPlan);
router.get('/subscriptions/payments', getSubscriptionPayments);

// Manual Owner Subscription Override
router.get('/owner-subscriptions', getOwnerSubscriptionsList);
router.post('/owner-subscriptions/grant', grantOwnerSubscription);
router.post('/owner-subscriptions/revoke', revokeOwnerSubscription);

// Maintenance Mode
router.get('/maintenance', getMaintenanceMode);
router.post('/maintenance', toggleMaintenanceMode);

// Platform Midtrans Payment Gateway (Super Admin owned — for subscription payments)
router.get('/payment-gateway/platform', getPlatformGatewayConfig);
router.post('/payment-gateway/platform', savePlatformGatewayConfig);
router.post('/payment-gateway/platform/test', testPlatformGatewayConnection);
router.delete('/payment-gateway/platform', deletePlatformGatewayConfig);

export default router;
