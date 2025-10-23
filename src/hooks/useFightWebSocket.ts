import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Real-Time Fight WebSocket Hook
 * 
 * Connects to backend WebSocket and listens for fight events
 * ✅ Synchronized across all clients
 * ✅ Server-authoritative fight logic
 * ✅ Best Practice: Room-based architecture
 */

export interface RoundStartData {
  fightId: string;
  roundNumber: number;
  timestamp: number;
}

export interface RoundCompleteData {
  fightId: string;
  roundNumber: number;
  winnerId: string;
  cock1Health: number;
  cock2Health: number;
  cock1Damage: number;
  cock2Damage: number;
  timestamp: number;
}

export interface FightFinishedData {
  fightId: string;
  winnerId: string;
  cock1RoundWins: number;
  cock2RoundWins: number;
  totalRounds: number;
  timestamp: number;
}

export interface FightStartingData {
  fightId: string;
  cock1Id: string;
  cock2Id: string;
  fightSeed: number;
  timestamp: number;
}

export const useFightWebSocket = (fightId: string | undefined) => {
  const [isConnected, setIsConnected] = useState(false);
  const [roundStart, setRoundStart] = useState<RoundStartData | null>(null);
  const [roundComplete, setRoundComplete] = useState<RoundCompleteData | null>(null);
  const [fightFinished, setFightFinished] = useState<FightFinishedData | null>(null);
  const [fightStarting, setFightStarting] = useState<FightStartingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!fightId) return;

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    console.log(`[WebSocket] Connecting to fight: ${fightId}`);
    console.log(`[WebSocket] API Base URL: ${apiBaseUrl}`);
    
    if (!apiBaseUrl) {
      console.error('[WebSocket] ❌ VITE_API_BASE_URL is not set! WebSocket cannot connect.');
      setError('API URL not configured');
      return;
    }

    // WebSocket is served at root level, not under /api prefix
    // So we need to strip /api from the URL
    const wsBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
    console.log(`[WebSocket] WebSocket Base URL: ${wsBaseUrl}`);
    console.log(`[WebSocket] Full URL: ${wsBaseUrl}/fights`);

    // Connect to WebSocket namespace
    const socket = io(`${wsBaseUrl}/fights`, {
      transports: ['websocket', 'polling'],
      auth: {
        token: localStorage.getItem('cfc.accessToken'), // JWT auth
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection handlers
    socket.on('connect', () => {
      console.log('[WebSocket] ✅ Connected to fight server');
      setIsConnected(true);
      setError(null);
      
      // Join the fight room
      socket.emit('join-fight', { fightId }, (response: any) => {
        console.log('[WebSocket] Joined fight room:', response);
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] ❌ Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[WebSocket] Connection error:', err.message);
      setError(`Connection error: ${err.message}`);
    });

    // Fight event handlers
    socket.on('fight-starting', (data: FightStartingData) => {
      console.log('[WebSocket] 🎮 Fight starting:', data);
      setFightStarting(data);
    });

    socket.on('round-start', (data: RoundStartData) => {
      console.log('[WebSocket] ⚔️  Round starting:', data.roundNumber);
      setRoundStart(data);
    });

    socket.on('round-complete', (data: RoundCompleteData) => {
      console.log('[WebSocket] ✅ Round complete:', data);
      setRoundComplete(data);
    });

    socket.on('fight-finished', (data: FightFinishedData) => {
      console.log('[WebSocket] 🏆 Fight finished! Winner:', data.winnerId);
      setFightFinished(data);
    });

    socket.on('fight-error', (data: { error: { message: string; code?: string } }) => {
      console.error('[WebSocket] ❌ Fight error:', data.error);
      setError(data.error.message);
    });

    socket.on('spectator-count', (data: { count: number }) => {
      console.log('[WebSocket] 👥 Spectators:', data.count);
    });

    // Cleanup on unmount
    return () => {
      console.log('[WebSocket] 🔌 Disconnecting from fight:', fightId);
      if (socketRef.current) {
        socketRef.current.emit('leave-fight', { fightId });
        socketRef.current.disconnect();
      }
    };
  }, [fightId]);

  // Helper to manually rejoin (useful after reconnection)
  const rejoin = useCallback(() => {
    if (socketRef.current && fightId) {
      socketRef.current.emit('join-fight', { fightId });
    }
  }, [fightId]);

  return {
    isConnected,
    fightStarting,
    roundStart,
    roundComplete,
    fightFinished,
    error,
    socket: socketRef.current,
    rejoin,
  };
};
