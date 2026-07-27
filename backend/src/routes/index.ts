import { Router } from 'express';
import authRoutes from './auth';
import storeRoutes from './store';
import cashierRoutes from './cashier';
import productRoutes from './product';
import transactionRoutes from './transaction';
import paymentRoutes from './payment';
import analyticsRoutes from './analytics';
import superAdminRoutes from './superadmin';
import superadminProfileRoutes from './superadminProfile';
import subscriptionRoutes from './subscription';
import sessionRoutes from './sessions';
import userRoutes from './users';
import taxRoutes from './tax';
import paymentGatewayRoutes from './paymentGateway';

const router = Router();

router.use('/auth', authRoutes);
router.use('/stores', storeRoutes);
router.use('/cashiers', cashierRoutes);
router.use('/products', productRoutes);
router.use('/transactions', transactionRoutes);
router.use('/payments', paymentRoutes);
router.use('/payment', paymentRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/superadmin', superAdminRoutes);
router.use('/admin', superAdminRoutes);
router.use('/super-admin', superadminProfileRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/sessions', sessionRoutes);
router.use('/users', userRoutes);
router.use('/tax', taxRoutes);
router.use('/', paymentGatewayRoutes);

export default router;
