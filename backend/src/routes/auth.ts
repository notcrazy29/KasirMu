import { Router } from 'express';
import { 
  registerOwner, 
  loginUser, 
  registerSchema, 
  loginSchema,
  googleLogin,
  completeProfile,
  completeProfileSchema,
  sendOTP,
  verifyOTP,
  resetProfileStatus,
  sendForgotPasswordOTP,
  verifyForgotPasswordOTP,
  resetPassword,
  createInitialPassword,
  updateUsername,
  updatePassword,
  linkGoogleAccount,
  unlinkGoogleAccount,
  updateEmail,
} from '../controllers/auth';
import { verifyEmail } from '../controllers/superadminProfile';
import { refreshToken } from '../controllers/session';
import { validateRequest } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/register', validateRequest(registerSchema), registerOwner);
router.post('/login', validateRequest(loginSchema), loginUser);

// Google Sign-in / Sign-up
router.post('/google', googleLogin);

// Refresh Access Token
router.post('/refresh', refreshToken);

// Forgot Password Flow
router.post('/forgot-password/send-otp', sendForgotPasswordOTP);
router.post('/forgot-password/verify-otp', verifyForgotPasswordOTP);
router.post('/forgot-password/reset-password', resetPassword);

// Password creation endpoint (requires auth)
router.post('/password/create', authenticate, createInitialPassword);

// Registration Complete Profile (requires auth)
router.post('/profile/complete', authenticate, validateRequest(completeProfileSchema), completeProfile);
router.post('/profile/reset', authenticate, resetProfileStatus);

// Profile Settings Management (requires auth)
router.post('/profile/update-username', authenticate, updateUsername);
router.post('/profile/update-password', authenticate, updatePassword);
router.post('/profile/link-google', authenticate, linkGoogleAccount);
router.post('/profile/unlink-google', authenticate, unlinkGoogleAccount);
router.post('/profile/update-email', authenticate, updateEmail);

// OTP Phone Verification (requires auth)
router.post('/otp/send', authenticate, sendOTP);
router.post('/otp/verify', authenticate, verifyOTP);

// Email Change Verification
router.get('/verify-email', verifyEmail);

export default router;


