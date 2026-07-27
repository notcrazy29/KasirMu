import { Router } from 'express';
import {
  createTransaction,
  getTransactions,
  getTransactionDetail,
  startShift,
  endShift,
  getActiveShift,
  getShifts,
  forceEndShift,
  getNextCashiers,
  getTodayShifts,
  createTransactionSchema,
  startShiftSchema,
  endShiftSchema,
} from '../controllers/transaction';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';

const router = Router();

router.use(authenticate);
router.use(authorize(['CASHIER', 'OWNER']));

// Transactions
router.post('/', validateRequest(createTransactionSchema), createTransaction);
router.get('/', getTransactions);

// Cashier Shifts
router.post('/shifts/start', validateRequest(startShiftSchema), startShift);
router.post('/shifts/end', validateRequest(endShiftSchema), endShift);
router.get('/shifts/active', getActiveShift);
router.get('/shifts', getShifts);
router.get('/shifts/next-cashiers', getNextCashiers);
router.get('/shifts/today', getTodayShifts);
router.post('/shifts/:id/force-end', forceEndShift);

router.get('/:id', getTransactionDetail);

export default router;
