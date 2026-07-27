import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import jwt from 'jsonwebtoken';
import { logAudit } from '../services/audit';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'kasirmu_super_jwt_secret_key_2026_secure';

// Helper to set secure HTTP-only refresh token cookie
export const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// Helper to create a new session, handle single session constraint for cashiers, and generate JWTs
export const createSessionAndTokens = async (
  user: any,
  req: Request,
  res: Response
) => {
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  const { deviceId, deviceName, browser, os } = req.body || {};
  const finalDeviceId = deviceId || (req.headers['x-device-id'] as string) || crypto.randomBytes(16).toString('hex');
  const finalDeviceName = deviceName || (req.headers['x-device-name'] as string) || 'Perangkat Unknown';
  const finalBrowser = browser || (req.headers['x-browser'] as string) || 'Browser Unknown';
  const finalOs = os || (req.headers['x-os'] as string) || 'OS Unknown';

  // 1. Enforce cashier single active session on a single device
  if (user.role === 'CASHIER') {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const activeSessions = await prisma.userSession.findMany({
      where: {
        userId: user.id,
        isActive: true,
        lastActivity: { gte: thirtyMinsAgo }
      }
    });

    if (activeSessions.length > 0) {
      // Check if any active session is on a DIFFERENT device
      const otherDeviceSession = activeSessions.find(s => s.deviceId !== finalDeviceId);
      if (otherDeviceSession) {
        // Log audit for rejected login
        await logAudit({
          action: 'LOGIN_REJECTED',
          actorId: user.id,
          description: `Login ditolak untuk ${user.email}: Perangkat lain (${otherDeviceSession.deviceName}) sedang aktif.`
        });

        const err: any = new Error('Akun Kasir ini sedang digunakan pada perangkat lain.');
        err.statusCode = 409;
        err.details = 'Tutup sesi pada perangkat lama atau minta Owner melakukan reset sesi.';
        throw err;
      }

      // Same device: deactivate older sessions to issue fresh session
      const sameDeviceSessionIds = activeSessions.map(s => s.id);
      await prisma.userSession.updateMany({
        where: { id: { in: sameDeviceSessionIds } },
        data: { isActive: false }
      });
    }
  }

  // 2. Register session in database
  const newRefreshToken = crypto.randomBytes(40).toString('hex');
  const sessionToken = crypto.randomBytes(32).toString('hex');

  const newSession = await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken: newRefreshToken,
      sessionToken,
      deviceId: finalDeviceId,
      deviceName: finalDeviceName,
      browser: finalBrowser,
      os: finalOs,
      ipAddress,
      isActive: true,
      lastActivity: new Date(),
    }
  });

  // 3. Update User online status & device info
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isOnline: true,
      currentSessionId: newSession.id,
      deviceId: finalDeviceId,
      deviceName: finalDeviceName,
      browser: finalBrowser,
      os: finalOs,
      ipAddress,
      lastLogin: new Date(),
      lastActivity: new Date(),
      sessionToken,
    }
  });

  // 4. Generate Access Token (15 minutes)
  const storeId = user.role === 'OWNER' 
    ? (user.ownedStores && user.ownedStores.length > 0 ? user.ownedStores[0].id : null) 
    : user.storeId;

  const accessToken = jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      role: user.role, 
      status: user.status, 
      storeId,
      sessionId: newSession.id,
      sessionToken
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  // 5. Write cookies
  setRefreshTokenCookie(res, newRefreshToken);
  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  // Broadcast status to store room if storeId exists
  if (storeId) {
    try {
      const { emitToStore } = require('../services/socket');
      emitToStore(storeId, 'online_status', {
        userId: user.id,
        isOnline: true
      });
    } catch (err) {
      console.error(err);
    }
  }

  return { accessToken, sessionId: newSession.id, storeId };
};

// POST /api/auth/refresh (Refresh Access Token)
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Read refreshToken from cookies
    const cookies = req.headers.cookie 
      ? Object.fromEntries(req.headers.cookie.split(';').map(c => c.trim().split('='))) 
      : {};
    const refToken = cookies['refreshToken'];

    if (!refToken) {
      return res.status(401).json({ message: 'Refresh token missing' });
    }

    // Find session in DB
    const session = await prisma.userSession.findFirst({
      where: {
        refreshToken: refToken,
        isActive: true,
      }
    });

    if (!session) {
      return res.status(401).json({ message: 'Session invalid or inactive' });
    }

    // Check expiration (7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (session.createdAt < sevenDaysAgo) {
      // Mark session as inactive
      await prisma.userSession.update({
        where: { id: session.id },
        data: { isActive: false }
      });
      res.clearCookie('refreshToken');
      return res.status(401).json({ message: 'Session expired' });
    }

    // Fetch user details
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        ownedStores: {
          select: { id: true, name: true }
        }
      }
    });

    if (!user || user.status === 'SUSPENDED') {
      await prisma.userSession.update({
        where: { id: session.id },
        data: { isActive: false }
      });
      res.clearCookie('refreshToken');
      return res.status(401).json({ message: 'User invalid or suspended' });
    }

    // Generate new Access Token (15 minutes)
    const storeId = user.role === 'OWNER' 
      ? (user.ownedStores.length > 0 ? user.ownedStores[0].id : null) 
      : user.storeId;

    const newAccessToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role, 
        status: user.status, 
        storeId,
        sessionId: session.id 
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate new Refresh Token (Refresh Token Rotation)
    const newRefreshToken = crypto.randomBytes(40).toString('hex');

    // Update session in DB
    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: newRefreshToken,
        lastActivity: new Date(),
      }
    });

    // Set new refresh token cookie
    setRefreshTokenCookie(res, newRefreshToken);

    return res.json({
      accessToken: newAccessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        storeId,
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/sessions (List Active Sessions)
export const getActiveSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let sessions = [];

    if (authUser.role === 'SUPER_ADMIN') {
      sessions = await prisma.userSession.findMany({
        where: { isActive: true },
        orderBy: { lastActivity: 'desc' }
      });
    } else if (authUser.role === 'OWNER') {
      // Find all cashier sessions belonging to the owner's stores
      const storeCashiers = await prisma.user.findMany({
        where: { storeId: authUser.storeId, role: 'CASHIER' },
        select: { id: true }
      });
      const cashierIds = storeCashiers.map(c => c.id);
      
      // Also include owner's own sessions
      const userIds = [authUser.id, ...cashierIds];

      sessions = await prisma.userSession.findMany({
        where: {
          userId: { in: userIds },
          isActive: true
        },
        orderBy: { lastActivity: 'desc' }
      });
    } else {
      // Cashier sees only their own sessions
      sessions = await prisma.userSession.findMany({
        where: {
          userId: authUser.id,
          isActive: true
        },
        orderBy: { lastActivity: 'desc' }
      });
    }

    return res.json({ sessions });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/sessions/:id (Revoke Session by ID)
export const revokeSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const authUser = (req as any).user;

    const session = await prisma.userSession.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ message: 'Session tidak ditemukan' });
    }

    // Permission check
    if (authUser.role === 'CASHIER' && session.userId !== authUser.id) {
      return res.status(403).json({ message: 'Forbidden: Cannot revoke other users sessions' });
    }

    if (authUser.role === 'OWNER') {
      // Owner can revoke sessions of cashiers in their store
      const cashier = await prisma.user.findUnique({
        where: { id: session.userId }
      });
      if (cashier && cashier.role === 'CASHIER' && cashier.storeId !== authUser.storeId && session.userId !== authUser.id) {
        return res.status(403).json({ message: 'Forbidden: Cannot revoke sessions of cashiers outside your store' });
      }
    }

    // Mark session as inactive
    const updatedSession = await prisma.userSession.update({
      where: { id },
      data: { isActive: false }
    });

    // Check if the user is now completely offline (no active sessions left)
    const activeSessionCount = await prisma.userSession.count({
      where: { userId: session.userId, isActive: true }
    });

    if (activeSessionCount === 0) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { isOnline: false, lastSeen: new Date() }
      });

      // Broadcast offline status via Socket
      try {
        const { emitToStore } = require('../services/socket');
        const user = await prisma.user.findUnique({ where: { id: session.userId } });
        if (user && user.storeId) {
          emitToStore(user.storeId, 'online_status', {
            userId: user.id,
            isOnline: false,
            lastSeen: new Date()
          });
        }
      } catch (err) {
        console.error('Socket broadcast failed:', err);
      }
    }

    // Send terminate event and disconnect client socket
    try {
      const { getIO } = require('../services/socket');
      const io = getIO();
      io.to(`session_${id}`).emit('session_terminated', {
        message: 'Sesi Anda telah dicabut oleh administrator.'
      });
      
      const sockets = io.sockets.adapter.rooms.get(`session_${id}`);
      if (sockets) {
        for (const socketId of sockets) {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.disconnect(true);
          }
        }
      }
    } catch (err) {
      console.error('Socket disconnection failed:', err);
    }

    await logAudit({
      action: 'REVOKE_SESSION',
      actorId: authUser.id,
      targetId: session.userId,
      description: `Session revoked for user ID ${session.userId} (Session ID: ${id})`,
    });

    return res.json({ message: 'Sesi berhasil dicabut' });
  } catch (error) {
    next(error);
  }
};

// POST /api/sessions/logout (Logout current session)
export const logoutCurrentSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user;
    if (!authUser || !authUser.sessionId) {
      res.clearCookie('refreshToken');
      res.clearCookie('token');
      return res.json({ message: 'Logged out' });
    }

    const sessionId = authUser.sessionId;

    // Revoke current session
    await prisma.userSession.update({
      where: { id: sessionId },
      data: { isActive: false }
    });

    // Check if user has other active sessions
    const activeSessionCount = await prisma.userSession.count({
      where: { userId: authUser.id, isActive: true }
    });

    if (activeSessionCount === 0) {
      await prisma.user.update({
        where: { id: authUser.id },
        data: { isOnline: false, lastSeen: new Date() }
      });

      // Broadcast status
      try {
        const { emitToStore } = require('../services/socket');
        if (authUser.storeId) {
          emitToStore(authUser.storeId, 'online_status', {
            userId: authUser.id,
            isOnline: false,
            lastSeen: new Date()
          });
        }
      } catch (err) {
        console.error(err);
      }
    }

    // Disconnect websocket
    try {
      const { getIO } = require('../services/socket');
      const io = getIO();
      const sockets = io.sockets.adapter.rooms.get(`session_${sessionId}`);
      if (sockets) {
        for (const socketId of sockets) {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.disconnect(true);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }

    res.clearCookie('refreshToken');
    res.clearCookie('token');

    await logAudit({
      action: 'LOGOUT',
      actorId: authUser.id,
      description: `User logged out of session ${sessionId}`,
    });

    return res.json({ message: 'Logout berhasil' });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/online (Get online status of cashiers)
export const getOnlineUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user;
    if (!authUser || authUser.role === 'CASHIER') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Find all cashiers in the owner's store
    const cashiers = await prisma.user.findMany({
      where: {
        storeId: authUser.storeId,
        role: 'CASHIER'
      },
      select: {
        id: true,
        name: true,
        email: true,
        isOnline: true,
        lastSeen: true,
        storeLogo: true, // Google profile picture is mapped here in new flow
      }
    });

    // Map active session details
    const activeSessions = await prisma.userSession.findMany({
      where: {
        userId: { in: cashiers.map(c => c.id) },
        isActive: true
      }
    });

    // Match shifts for these cashiers
    const activeShifts = await prisma.shift.findMany({
      where: {
        userId: { in: cashiers.map(c => c.id) },
        status: 'OPEN'
      }
    });

    const result = cashiers.map(c => {
      const session = activeSessions.find(s => s.userId === c.id);
      const shift = activeShifts.find(s => s.userId === c.id);
      return {
        ...c,
        device: session ? session.deviceName : null,
        browser: session ? session.browser : null,
        os: session ? session.os : null,
        ipAddress: session ? session.ipAddress : null,
        loginTime: session ? session.createdAt : null,
        lastActivity: session ? session.lastActivity : null,
        shiftStatus: shift ? 'OPEN' : 'CLOSED',
        shiftId: shift ? shift.id : null,
      };
    });

    return res.json({ cashiers: result });
  } catch (error) {
    next(error);
  }
};

// POST /api/users/force-logout (Force logout a cashier by Owner)
export const forceLogoutCashier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user;
    const { cashierId } = req.body;

    if (!cashierId) {
      return res.status(400).json({ message: 'Cashier ID wajib diisi' });
    }

    if (authUser.role !== 'OWNER' && authUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Forbidden: Owner permission required' });
    }

    const cashier = await prisma.user.findUnique({
      where: { id: cashierId }
    });

    if (!cashier || cashier.role !== 'CASHIER') {
      return res.status(404).json({ message: 'Kasir tidak ditemukan' });
    }

    if (authUser.role === 'OWNER' && cashier.storeId !== authUser.storeId) {
      return res.status(403).json({ message: 'Forbidden: Cannot force logout cashier outside your store' });
    }

    // Revoke all active sessions for this cashier
    const sessions = await prisma.userSession.findMany({
      where: { userId: cashierId, isActive: true }
    });

    const sessionIds = sessions.map(s => s.id);

    await prisma.userSession.updateMany({
      where: { id: { in: sessionIds } },
      data: { isActive: false }
    });

    // Update user record to offline
    await prisma.user.update({
      where: { id: cashierId },
      data: { isOnline: false, lastSeen: new Date() }
    });

    // Broadcast offline status via sockets
    try {
      const { emitToStore, getIO } = require('../services/socket');
      if (cashier.storeId) {
        emitToStore(cashier.storeId, 'online_status', {
          userId: cashierId,
          isOnline: false,
          lastSeen: new Date()
        });
      }

      // Notify and disconnect all websocket connections for these sessions
      const io = getIO();
      for (const sid of sessionIds) {
        io.to(`session_${sid}`).emit('session_terminated', {
          message: 'Anda telah dikeluarkan (force logout) oleh Owner.'
        });
        
        const sockets = io.sockets.adapter.rooms.get(`session_${sid}`);
        if (sockets) {
          for (const socketId of sockets) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              socket.disconnect(true);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    }

    await logAudit({
      action: 'FORCE_LOGOUT',
      actorId: authUser.id,
      targetId: cashierId,
      description: `Owner force logged out cashier: ${cashier.email}`,
    });

    return res.json({ message: 'Kasir berhasil dikeluarkan' });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/last-seen (Get last seen parameters)
export const getUsersLastSeen = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user;
    if (!authUser || authUser.role === 'CASHIER') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const cashiers = await prisma.user.findMany({
      where: { storeId: authUser.storeId, role: 'CASHIER' },
      select: {
        id: true,
        name: true,
        isOnline: true,
        lastSeen: true,
      }
    });

    return res.json({ cashiers });
  } catch (error) {
    next(error);
  }
};
