import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * WebSocket Gateway for Real-Time Fight Synchronization
 * 
 * Best Practices Implemented:
 * 1. Room-based architecture - Each fight has its own room
 * 2. Server-authoritative - Backend controls fight logic
 * 3. Event-driven communication - Broadcasts to all clients in room
 * 4. Proper connection management - Handles disconnects gracefully
 * 5. Authentication - Validates JWT tokens on connection
 */
@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      // Allow all origins in development, specific origins in production
      const allowedOrigins = process.env.FRONTEND_URL 
        ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
        : ['http://localhost:3000', 'http://localhost:5173'];
      
      // In development, allow all origins
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
        return;
      }
      
      // In production, check against allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  namespace: '/fights', // Separate namespace for fight events
  transports: ['websocket', 'polling'], // Fallback to polling if needed
})
export class FightsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(FightsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('✅ WebSocket Gateway initialized for real-time fights');
    this.logger.log(`🌐 CORS configured for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    this.logger.log(`🔊 Listening on namespace: /fights`);
  }

  /**
   * Handle client connection
   * Validates JWT token and logs connection
   */
  async handleConnection(client: Socket) {
    try {
      this.logger.log(`[Connection] Client attempting to connect: ${client.id}`);
      this.logger.log(`[Connection] Origin: ${client.handshake.headers.origin || 'unknown'}`);
      this.logger.log(`[Connection] Transports: ${client.conn.transport.name}`);
      
      // Extract token from handshake (query params or headers)
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (token) {
        try {
          const payload = this.jwtService.verify(token);
          client.data.userId = payload.userId;
          client.data.walletAddress = payload.walletAddress;
          this.logger.log(`✅ Client authenticated: ${client.id} (User: ${payload.walletAddress})`);
        } catch (error) {
          this.logger.warn(`⚠️  Invalid token on connection: ${client.id}`);
          // Still allow connection for anonymous spectating
        }
      } else {
        // Allow anonymous spectators
        this.logger.log(`👤 Anonymous client connected: ${client.id}`);
      }
      
      this.logger.log(`✅ Client connected successfully: ${client.id}`);
    } catch (error) {
      this.logger.error(`❌ Connection error for ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle client disconnection
   * Cleans up room subscriptions
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Client subscribes to a specific fight
   * Joins the fight room to receive real-time updates
   */
  @SubscribeMessage('join-fight')
  handleJoinFight(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { fightId: string },
  ) {
    const { fightId } = data;
    
    this.logger.log(`[Room Join] Client ${client.id} joining fight: ${fightId}`);
    
    // Join the fight room
    client.join(`fight:${fightId}`);
    
    this.logger.log(`✅ Client ${client.id} successfully joined fight room: ${fightId}`);
    
    // Send acknowledgment
    client.emit('fight-joined', { fightId, success: true });
    
    // Broadcast spectator count update
    this.emitSpectatorCount(fightId);
    
    return { success: true, fightId };
  }

  /**
   * Client unsubscribes from a fight
   */
  @SubscribeMessage('leave-fight')
  handleLeaveFight(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { fightId: string },
  ) {
    const { fightId } = data;
    
    client.leave(`fight:${fightId}`);
    
    this.logger.log(`Client ${client.id} left fight room: ${fightId}`);
    
    return { success: true, fightId };
  }

  /**
   * Broadcast that a fight is starting (betting ended)
   */
  emitFightStarting(fightId: string, data: { cock1Id: string; cock2Id: string; fightSeed: number }) {
    this.logger.log(`[WS] Broadcasting fight-starting for ${fightId}`);
    
    this.server.to(`fight:${fightId}`).emit('fight-starting', {
      fightId,
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast countdown between rounds
   */
  emitRoundCountdown(fightId: string, data: { roundNumber: number; secondsRemaining: number }) {
    this.server.to(`fight:${fightId}`).emit('round-countdown', {
      fightId,
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast that a round is starting
   */
  emitRoundStart(fightId: string, data: { roundNumber: number }) {
    this.logger.log(`[WS] Broadcasting round-start for ${fightId} - Round ${data.roundNumber}`);
    
    this.server.to(`fight:${fightId}`).emit('round-start', {
      fightId,
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast round results
   * This is the key synchronization event - all clients receive this simultaneously
   */
  emitRoundComplete(fightId: string, data: {
    roundNumber: number;
    winnerId: string;
    cock1Health: number;
    cock2Health: number;
    cock1Damage: number;
    cock2Damage: number;
  }) {
    this.logger.log(`[WS] Broadcasting round-complete for ${fightId} - Round ${data.roundNumber} (Winner: ${data.winnerId})`);
    
    this.server.to(`fight:${fightId}`).emit('round-complete', {
      fightId,
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast that the entire fight is finished
   */
  emitFightFinished(fightId: string, data: {
    winnerId: string;
    cock1RoundWins: number;
    cock2RoundWins: number;
    totalRounds: number;
  }) {
    this.logger.log(`[WS] Broadcasting fight-finished for ${fightId} (Winner: ${data.winnerId})`);
    
    this.server.to(`fight:${fightId}`).emit('fight-finished', {
      fightId,
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast fight error
   */
  emitFightError(fightId: string, error: { message: string; code?: string }) {
    this.logger.error(`[WS] Broadcasting fight-error for ${fightId}: ${error.message}`);
    
    this.server.to(`fight:${fightId}`).emit('fight-error', {
      fightId,
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * Get number of spectators in a fight room
   */
  async getRoomSize(fightId: string): Promise<number> {
    const room = await this.server.in(`fight:${fightId}`).fetchSockets();
    return room.length;
  }

  /**
   * Broadcast spectator count update
   */
  async emitSpectatorCount(fightId: string) {
    const count = await this.getRoomSize(fightId);
    
    this.server.to(`fight:${fightId}`).emit('spectator-count', {
      fightId,
      count,
      timestamp: Date.now(),
    });
  }
}
