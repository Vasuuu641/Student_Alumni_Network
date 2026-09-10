// Notifications WebSocket Gateway
// Namespace: /notifications
// Room key pattern: notifications:{userId}
// Real-time delivery of new notifications and unread-count updates

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import type { TokenService } from 'src/domain/services/token-service';
import type { NotificationsRealtimePublisher } from 'src/domain/services/notifications-realtime-publisher';
import { Notification } from 'src/domain/entities/notification.entity';

interface SocketSession {
  userId: string;
  role: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, NotificationsRealtimePublisher
{
  @WebSocketServer()
  server!: Namespace;

  private readonly logger = new Logger(NotificationsGateway.name);
  
  constructor(
    @Inject('TokenService') private readonly tokenService: TokenService,
  ) {}

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(socket: Socket) {
    try {
      const session = await this.extractAndVerifyToken(socket);
      socket.data.session = session;

      // Every user gets exactly one permanent room — no explicit join/leave
      // events needed like study-groups, since there's nothing to choose.
      const roomKey = this.roomFor(session.userId);
      await socket.join(roomKey);

      this.logger.log(`Socket connected: ${socket.id} | user: ${session.userId}`);
    } catch {
      this.logger.warn(`Socket rejected (invalid token): ${socket.id}`);
      socket.emit('error', { message: 'Unauthorized: invalid or missing token' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Socket disconnected: ${socket.id}`);
  }

  // ─── Realtime publisher methods ───────────────────────────────────────────

  pushNewNotification(userId: string, notification: Notification): void {
    const roomKey = this.roomFor(userId);
    this.server.to(roomKey).emit('notifications:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      entityType: notification.entityType,
      entityId: notification.entityId,
      actionUrl: notification.actionUrl,
      score: notification.score,
      createdAt: notification.createdAt,
    });
    this.logger.log(`New notification broadcast: user ${userId} notification ${notification.id}`);
  }

  pushUnreadCount(userId: string, unreadCount: number): void {
    const roomKey = this.roomFor(userId);
    this.server.to(roomKey).emit('notifications:unread-count', { unreadCount });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private roomFor(userId: string): string {
    return `notifications:${userId}`;
  }

  private async extractAndVerifyToken(socket: Socket): Promise<SocketSession> {
    const authHeader = socket.handshake.headers?.authorization as string;
    const authToken = socket.handshake.auth?.token as string;
    const queryToken = socket.handshake.query?.token as string;

    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (authToken) {
      token = authToken;
    } else if (queryToken) {
      token = queryToken;
    }

    if (!token) throw new Error('No token provided');

    const payload = await this.tokenService.verifyAccessToken(token);
    return {
      userId: payload.userId,
      role: payload.role,
    };
  }
}