import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

const parseJwt = (token: string) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { currentStoreId, token, logout } = useAuthStore();

  useEffect(() => {
    // If no store is selected or no token, do not connect
    if (!token) return;

    // Connect to Socket.io Server and pass token in auth
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      withCredentials: true,
      auth: { token },
    });

    socketRef.current = socket;

    // Decode session ID from access token
    const decoded = parseJwt(token);
    const sessionId = decoded?.sessionId;

    // Set up heartbeat timer
    let heartbeatTimer: NodeJS.Timeout | null = null;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected to server, ID:', socket.id);
      
      if (currentStoreId) {
        socket.emit('join_store', currentStoreId);
      }

      // Start 30s heartbeat interval
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        const latestToken = useAuthStore.getState().token;
        const latestDecoded = latestToken ? parseJwt(latestToken) : null;
        const currentSessionId = latestDecoded?.sessionId || sessionId;

        if (currentSessionId) {
          socket.emit('heartbeat', { sessionId: currentSessionId });
        }
      }, 30 * 1000);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket] Disconnected from server');
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    });

    // Handle session termination event
    socket.on('session_terminated', (data: { message?: string }) => {
      console.log('[Socket] Session terminated event received:', data);
      alert(data?.message || 'Anda telah logout karena akun digunakan pada perangkat lain.');
      
      // Perform client-side logout
      logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    });

    return () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      if (socket) {
        if (currentStoreId) {
          socket.emit('leave_store', currentStoreId);
        }
        socket.disconnect();
      }
    };
  }, [currentStoreId, token, logout]);

  const on = (event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  const emit = (event: string, data: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  };

  return { isConnected, on, off, emit };
};

export default useSocket;
