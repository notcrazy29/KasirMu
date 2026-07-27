import { Router } from 'express';
import { getDashboardStats } from '../controllers/analytics';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

router.use(authenticate);
router.use(authorize(['OWNER']));

router.get('/dashboard', getDashboardStats);

export default router;
