import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import {
  getProfile,
  updateProfile,
  changeUsername,
  changeEmail,
  changePassword,
  changePhone,
  verifyPhone,
  uploadAvatar,
  deleteAvatar,
  toggle2FA,
  logoutAllDevices
} from '../controllers/superadminProfile';

const router = Router();

// Secure all super admin account endpoints
router.use(authenticate);
router.use(authorize(['SUPER_ADMIN']));

router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.patch('/change-username', changeUsername);
router.patch('/change-email', changeEmail);
router.patch('/change-password', changePassword);
router.patch('/change-phone', changePhone);
router.post('/verify-phone', verifyPhone);
router.post('/upload-avatar', uploadAvatar);
router.delete('/avatar', deleteAvatar);
router.post('/toggle-2fa', toggle2FA);
router.post('/logout-all-devices', logoutAllDevices);

export default router;
