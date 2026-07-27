import { Router } from 'express';
import { 
  createPayment, 
  getPaymentStatus, 
  cancelPayment, 
  handleMidtransWebhook, 
  simulatePaymentCallback 
} from '../controllers/payment';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Public webhook invoked by Midtrans
router.post('/webhook', handleMidtransWebhook);

// Dev simulator callback - public for mock testing
router.post('/simulate-callback', simulatePaymentCallback);

// Cashier endpoints requiring authentication
router.post('/create', authenticate, createPayment);
router.get('/status/:id', authenticate, getPaymentStatus);
router.post('/cancel', authenticate, cancelPayment);

export default router;
