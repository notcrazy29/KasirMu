import { Router } from 'express';
import {
  createStore,
  getStores,
  createBranch,
  getBranches,
  getStoreDetails,
  createStoreSchema,
  createBranchSchema,
  verifyStorePin,
  updateStorePin,
  updateStoreMidtrans,
} from '../controllers/store';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';
import { checkLimit } from '../middlewares/subscription';


const router = Router();

router.use(authenticate);

router.post('/', authorize(['OWNER']), checkLimit('store'), validateRequest(createStoreSchema), createStore);

router.get('/', getStores);
router.get('/:storeId', getStoreDetails);
router.post('/:storeId/branches', authorize(['OWNER']), validateRequest(createBranchSchema), createBranch);
router.get('/:storeId/branches', getBranches);
router.post('/:storeId/verify-pin', verifyStorePin);
router.post('/:storeId/update-pin', authorize(['OWNER']), updateStorePin);
router.post('/:storeId/update-midtrans', authorize(['OWNER']), updateStoreMidtrans);

export default router;
