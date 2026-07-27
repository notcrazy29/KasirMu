import { Router } from 'express';
import { 
  getOnlineUsers, 
  forceLogoutCashier, 
  getUsersLastSeen 
} from '../controllers/session';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/online', getOnlineUsers);
router.post('/force-logout', forceLogoutCashier);
router.get('/last-seen', getUsersLastSeen);

export default router;
