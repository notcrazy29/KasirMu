import { Router } from 'express';
import { 
  getActiveSessions, 
  revokeSession, 
  logoutCurrentSession 
} from '../controllers/session';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getActiveSessions);
router.delete('/:id', revokeSession);
router.post('/logout', logoutCurrentSession);

export default router;
