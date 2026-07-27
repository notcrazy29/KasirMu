import { Router } from 'express';
import {
  getTaxSetting,
  updateTaxSetting,
  deleteTaxSetting,
  updateTaxSettingSchema,
} from '../controllers/tax';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';

const router = Router();

router.use(authenticate);

// GET is accessible by all roles (OWNER, CASHIER, SUPER_ADMIN)
router.get('/', getTaxSetting);

// POST, PUT, PATCH, DELETE are restricted to OWNER only (CASHIER gets 403 Forbidden)
router.post('/', authorize(['OWNER']), validateRequest(updateTaxSettingSchema), updateTaxSetting);
router.put('/', authorize(['OWNER']), validateRequest(updateTaxSettingSchema), updateTaxSetting);
router.patch('/', authorize(['OWNER']), validateRequest(updateTaxSettingSchema), updateTaxSetting);
router.delete('/', authorize(['OWNER']), deleteTaxSetting);

export default router;
