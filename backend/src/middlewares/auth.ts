import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'kasirmu_super_jwt_secret_key_2026_secure';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'OWNER' | 'CASHIER' | 'SUPER_ADMIN';
    status?: string;
    storeId?: string | null;
    impersonatedBy?: string | null;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token = '';
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(';').map(c => c.trim().split('='))
    );
    token = cookies['token'] || '';
  }

  if (!token) {
    return res.status(401).json({ message: 'Authorization token missing or invalid' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Query database to check for real-time status updates (suspensions, rejection, or session reset)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { status: true, isOnline: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found or deleted' });
    }

    if (decoded.role === 'CASHIER' && decoded.sessionId) {
      const activeSession = await prisma.userSession.findUnique({
        where: { id: decoded.sessionId }
      });
      if (!activeSession || !activeSession.isActive) {
        return res.status(401).json({ message: 'Sesi Anda telah di-reset oleh Owner atau berakhir. Silakan login kembali.' });
      }
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ message: 'Forbidden: Account has been suspended' });
    }

    if (user.status === 'REJECTED') {
      if (req.originalUrl.startsWith('/api/auth/profile/reset')) {
        req.user = { ...decoded, status: user.status };
        return next();
      }
      return res.status(403).json({ message: 'Forbidden: Registration request has been rejected' });
    }

    // Lock down incomplete owners from calling other APIs
    if (decoded.role === 'OWNER' && user.status !== 'ACTIVE') {
      const allowedUrls = [
        '/api/auth/profile/complete',
        '/api/auth/otp/send',
        '/api/auth/otp/verify',
        '/api/auth/me',
        '/api/auth/logout'
      ];
      
      const isAllowed = allowedUrls.some(url => req.originalUrl.startsWith(url));
      if (!isAllowed) {
        return res.status(403).json({ 
          message: `Forbidden: Lengkapi pendaftaran untuk mengakses resource ini`,
          status: user.status
        });
      }
    }

    req.user = {
      ...decoded,
      status: user.status
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token is invalid or expired' });
  }
};

export const authorize = (roles: ('OWNER' | 'CASHIER' | 'SUPER_ADMIN')[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};

export const superAdminGuard = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Forbidden: Super Admin access required' });
  }
  next();
};

export const checkPermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // SUPER_ADMIN bypasses all permission constraints
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const rolePermissions: Record<string, string[]> = {
      OWNER: [
        'manage_store',
        'manage_cashier',
        'view_reports',
        'manage_products',
        'view_transactions',
        'manage_branches',
        'create_payment',
        'manage_subscription',
      ],
      CASHIER: [
        'view_products',
        'create_transaction',
        'manage_shifts',
        'view_transactions',
      ],
    };

    const allowedPermissions = rolePermissions[req.user.role] || [];
    if (!allowedPermissions.includes(permission)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

export const maintenanceGuard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // SUPER_ADMIN bypasses maintenance mode
    if (req.user && req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const modeSetting = await prisma.systemSetting.findUnique({
      where: { key: 'maintenance_mode' },
    });

    if (modeSetting && modeSetting.value === 'true') {
      const messageSetting = await prisma.systemSetting.findUnique({
        where: { key: 'maintenance_message' },
      });
      const message = messageSetting?.value || 'System is currently undergoing maintenance.';
      return res.status(503).json({ 
        message, 
        maintenance: true 
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
