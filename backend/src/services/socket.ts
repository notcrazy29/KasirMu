import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'kasirmu_super_jwt_secret_key_2026_secure';

let io: SocketIOServer | null = null;
let sweepInterval: NodeJS.Timeout | null = null;

export const initSocket = (server: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', async (socket) => {
    if (!io) return;
    // 1. Authenticate handshakes via cookie or auth parameter
    let token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token && socket.handshake.headers.cookie) {
      const cookies = Object.fromEntries(
        socket.handshake.headers.cookie.split(';').map(c => c.trim().split('='))
      );
      token = cookies['token'];
    }

    let userId: string | null = null;
    let storeId: string | null = null;
    let sessionId: string | null = null;
    let role: string | null = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userId = decoded.id;
        storeId = decoded.storeId;
        sessionId = decoded.sessionId;
        role = decoded.role;
      } catch (err: any) {
        console.warn(`[Socket] Auth failed on connection: ${err.message}`);
      }
    }

    console.log(`[Socket] Connected: ${socket.id} (User: ${userId || 'Guest'}, Session: ${sessionId || 'None'})`);

    if (userId && sessionId) {
      // Join user and session specific channels
      socket.join(`user_${userId}`);
      socket.join(`session_${sessionId}`);

      // Set user status to ONLINE in DB and update session
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { isOnline: true }
        });

        // Update session activity
        await prisma.userSession.updateMany({
          where: { id: sessionId },
          data: { lastActivity: new Date(), isActive: true }
        });
      } catch (dbErr) {
        console.warn(`[Socket] Failed to update online status or session in DB: ${dbErr}`);
      }

      // Join store room
      if (storeId) {
        socket.join(`store_${storeId}`);
        // Broadcast online status to the store room
        io.to(`store_${storeId}`).emit('online_status', {
          userId,
          isOnline: true
        });
      }
    }

    // Join store room manually via event (fallback)
    socket.on('join_store', (sId: string) => {
      if (sId) {
        socket.join(`store_${sId}`);
        console.log(`[Socket] Socket ${socket.id} joined room store_${sId}`);
      }
    });

    // Leave store room
    socket.on('leave_store', (sId: string) => {
      if (sId) {
        socket.leave(`store_${sId}`);
        console.log(`[Socket] Socket ${socket.id} left room store_${sId}`);
      }
    });

    // Heartbeat listener
    socket.on('heartbeat', async (data: { sessionId: string }) => {
      const activeSessionId = data?.sessionId || sessionId;
      if (activeSessionId) {
        try {
          await prisma.userSession.update({
            where: { id: activeSessionId },
            data: { lastActivity: new Date(), isActive: true }
          });
        } catch (err) {
          // Silent catch
        }
      }
    });

    socket.on('disconnect', async () => {
      console.log(`[Socket] Disconnected: ${socket.id} (User: ${userId || 'Guest'})`);
      
      if (userId && sessionId) {
        // Find if this user has any OTHER active sessions
        const activeSessions = await prisma.userSession.findMany({
          where: {
            userId,
            id: { not: sessionId },
            isActive: true
          }
        });

        if (activeSessions.length === 0) {
          // No other active sessions, update to OFFLINE
          const now = new Date();
          await prisma.user.update({
            where: { id: userId },
            data: { isOnline: false, lastSeen: now }
          });

          // Broadcast offline status to store room
          if (storeId) {
            io?.to(`store_${storeId}`).emit('online_status', {
              userId,
              isOnline: false,
              lastSeen: now
            });
          }
        }
      }
    });
  });

  // Start background sweep interval every 30 seconds
  startSweepInterval();

  return io;
};

// Periodic 30 minutes inactivity timeout scanner
const startSweepInterval = () => {
  if (sweepInterval) clearInterval(sweepInterval);

  sweepInterval = setInterval(async () => {
    try {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

      // Find all active sessions where lastActivity > 30 minutes ago
      const expiredSessions = await prisma.userSession.findMany({
        where: {
          isActive: true,
          lastActivity: { lt: thirtyMinsAgo }
        }
      });

      if (expiredSessions.length > 0) {
        console.log(`[Socket Sweep] Found ${expiredSessions.length} inactive sessions (>30 min). Terminating...`);

        const { logAudit } = require('./audit');

        for (const session of expiredSessions) {
          // Mark session inactive
          await prisma.userSession.update({
            where: { id: session.id },
            data: { isActive: false }
          });

          // Check remaining sessions
          const otherSessions = await prisma.userSession.findMany({
            where: {
              userId: session.userId,
              isActive: true
            }
          });

          if (otherSessions.length === 0) {
            const now = new Date();
            const user = await prisma.user.update({
              where: { id: session.userId },
              data: { isOnline: false, lastSeen: now }
            });

            if (user.storeId && io) {
              io.to(`store_${user.storeId}`).emit('online_status', {
                userId: user.id,
                isOnline: false,
                lastSeen: now
              });
            }

            // Log auto logout audit
            try {
              await logAudit({
                action: 'AUTO_LOGOUT',
                actorId: session.userId,
                description: `Auto logout (inactivity 30 min) for session ${session.id}`
              });
            } catch (aErr) {
              // Silent
            }
          }

          // Disconnect matching client sockets
          if (io) {
            io.to(`session_${session.id}`).emit('session_terminated', {
              message: 'Sesi Anda telah berakhir karena tidak ada aktivitas selama 30 menit.'
            });
            const sockets = io.sockets.adapter.rooms.get(`session_${session.id}`);
            if (sockets) {
              for (const socketId of sockets) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                  socket.disconnect(true);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[Socket Sweep] Error running periodic heartbeat sweep:', err);
    }
  }, 30 * 1000);
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Please call initSocket first.');
  }
  return io;
};

export const emitToStore = (storeId: string, event: string, data: any) => {
  if (io) {
    io.to(`store_${storeId}`).emit(event, data);
    console.log(`[Socket] Emitted '${event}' to store_${storeId}`);
  } else {
    console.warn('[Socket] Attempted to emit, but socket.io is not initialized.');
  }
};
