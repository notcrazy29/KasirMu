import { Router } from 'express';
import {
  createCashier,
  getCashiers,
  pairCashier,
  updateCashier,
  deleteCashier,
  createCashierSchema,
  updateCashierSchema,
  pairStoreSchema,
} from '../controllers/cashier';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';
import { checkLimit } from '../middlewares/subscription';


const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(['OWNER']),
  checkLimit('cashier', (req) => req.body.storeId),
  validateRequest(createCashierSchema),
  createCashier
);

router.get('/', authorize(['OWNER']), getCashiers);
router.put('/:id', authorize(['OWNER']), validateRequest(updateCashierSchema), updateCashier);
router.delete('/:id', authorize(['OWNER']), deleteCashier);
router.post('/pair', validateRequest(pairStoreSchema), pairCashier);

export default router;
