// Study Groups WebSocket Gateway
// Namespace: /study-groups
// Room key pattern: study-groups:{groupId}
// Real-time updates for member presence, posts, and events

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import type { TokenService } from 'src/domain/services/token-service';
import type { StudyGroupRepository } from 'src/domain/repositories/study-group.repository';
import type { StudyGroupMemberRepository } from 'src/domain/repositories/study-group-member.repository';
import type { UserRepository } from 'src/domain/repositories/user.repository';
import { StudyGroupsRealtimePublisher } from 'src/domain/services/study-groups-realtime-publisher';
import { studyGroupsVisibility } from 'src/domain/entities/study-group.entity';
import { studyGroupJoinStatus } from 'src/domain/entities/study-group.entity';

interface SocketSession {
  userId: string;
  role: string;
}

interface PresenceIdentity {
  email: string | null;
  displayName: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/study-groups',
})
export class StudyGroupsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, StudyGroupsRealtimePublisher
{
  @WebSocketServer()
  server: Namespace;

  private readonly logger = new Logger(StudyGroupsGateway.name);

  private socketRooms = new Map<string, Set<string>>();

  constructor(
    @Inject('TokenService') private readonly tokenService: TokenService,
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
    @Inject('UserRepository') private readonly userRepository: UserRepository,
  ) {}

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(socket: Socket) {
    try {
      const session = await this.extractAndVerifyToken(socket);
      
      // Only STUDENT and PROFESSOR roles can access study groups
      if (session.role !== 'STUDENT' && session.role !== 'PROFESSOR') {
        this.logger.warn(`Socket rejected (invalid role): ${socket.id} | role: ${session.role}`);
        socket.emit('error', { message: 'Unauthorized: only students and professors can access study groups' });
        socket.disconnect(true);
        return;
      }
      
      socket.data.session = session;
      socket.data.identity = await this.resolvePresenceIdentity(session.userId);
      this.socketRooms.set(socket.id, new Set());
      this.logger.log(`Socket connected: ${socket.id} | user: ${session.userId} | role: ${session.role}`);
    } catch {
      this.logger.warn(`Socket rejected (invalid token): ${socket.id}`);
      socket.emit('error', { message: 'Unauthorized: invalid or missing token' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const rooms = this.socketRooms.get(socket.id) ?? new Set();
    for (const groupId of rooms) {
      const roomKey = `study-groups:${groupId}`;
      socket.to(roomKey).emit('study-groups:presence', {
        event: 'member-left',
        userId: socket.data.session?.userId,
      });
    }
    this.socketRooms.delete(socket.id);
    this.logger.log(`Socket disconnected: ${socket.id}`);
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  @SubscribeMessage('study-groups:join-room')
  async handleJoinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    const { groupId } = data;
    const session: SocketSession = socket.data.session;
    const identity: PresenceIdentity = socket.data.identity;

    // Verify group exists
    const group = await this.studyGroupRepository.findById(groupId);
    if (!group) {
      return this.emitError(socket, 'Study group not found');
    }

    // For public groups, allow any authenticated user
    // For private groups, require active membership
    if (group.visibility === studyGroupsVisibility.PRIVATE) {
      const members = await this.memberRepository.findByStudyGroupId(groupId);
      const isMember = members.some(
        (m) => m.userId === session.userId && m.joinStatus === studyGroupJoinStatus.ACTIVE,
      );
      if (!isMember) {
        return this.emitError(socket, 'Access denied: not a member of this private group');
      }
    }

    // Join room
    const roomKey = `study-groups:${groupId}`;
    await socket.join(roomKey);
    this.socketRooms.get(socket.id)?.add(groupId);

    // Emit joined confirmation
    socket.emit('study-groups:joined', {
      groupId,
      userId: session.userId,
      email: identity.email,
      displayName: identity.displayName,
    });

    // Broadcast presence
    socket.to(roomKey).emit('study-groups:presence', {
      event: 'member-joined',
      userId: session.userId,
      displayName: identity.displayName,
      email: identity.email,
    });

    this.logger.log(`User ${session.userId} joined study group ${groupId}`);
  }

  @SubscribeMessage('study-groups:leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    const { groupId } = data;
    const session: SocketSession = socket.data.session;
    const roomKey = `study-groups:${groupId}`;

    await socket.leave(roomKey);
    this.socketRooms.get(socket.id)?.delete(groupId);

    socket.to(roomKey).emit('study-groups:presence', {
      event: 'member-left',
      userId: session?.userId,
    });

    socket.emit('study-groups:left', { groupId });
    this.logger.log(`User ${session?.userId} left study group ${groupId}`);
  }

  // ─── Realtime publisher methods ───────────────────────────────────────────

  broadcastMemberJoined(groupId: string, member: any): void {
    const roomKey = `study-groups:${groupId}`;
    this.server.to(roomKey).emit('study-groups:member-joined', {
      groupId,
      ...member,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Member joined broadcast: group ${groupId} member ${member.userId}`);
  }

  broadcastMemberLeft(groupId: string, userId: string): void {
    const roomKey = `study-groups:${groupId}`;
    this.server.to(roomKey).emit('study-groups:member-left', {
      groupId,
      userId,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Member left broadcast: group ${groupId} member ${userId}`);
  }

  broadcastMemberRoleUpdated(groupId: string, userId: string, newRole: string): void {
    const roomKey = `study-groups:${groupId}`;
    this.server.to(roomKey).emit('study-groups:member-role-updated', {
      groupId,
      userId,
      newRole,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Member role updated broadcast: group ${groupId} member ${userId} role ${newRole}`);
  }

  broadcastPostCreated(groupId: string, post: any): void {
    const roomKey = `study-groups:${groupId}`;
    this.server.to(roomKey).emit('study-groups:post-created', {
      groupId,
      ...post,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Post created broadcast: group ${groupId} post ${post.id}`);
  }

  broadcastPostEdited(groupId: string, postId: string, content: string, editedAt: string): void {
    const roomKey = `study-groups:${groupId}`;
    this.server.to(roomKey).emit('study-groups:post-edited', {
      groupId,
      postId,
      content,
      editedAt,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Post edited broadcast: group ${groupId} post ${postId}`);
  }

  broadcastPostDeleted(groupId: string, postId: string): void {
    const roomKey = `study-groups:${groupId}`;
    this.server.to(roomKey).emit('study-groups:post-deleted', {
      groupId,
      postId,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Post deleted broadcast: group ${groupId} post ${postId}`);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

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

  private async resolvePresenceIdentity(userId: string): Promise<PresenceIdentity> {
    const user = await this.userRepository.findById(userId);
    if (!user) return { email: null, displayName: userId };

    const first = user.firstName?.trim() ?? '';
    const last = user.lastName?.trim() ?? '';
    const displayName = `${first} ${last}`.trim() || user.email.getValue();

    return {
      email: user.email.getValue(),
      displayName,
    };
  }

  private isInRoom(socket: Socket, groupId: string): boolean {
    return this.socketRooms.get(socket.id)?.has(groupId) ?? false;
  }

  private emitError(socket: Socket, message: string) {
    socket.emit('error', { message });
    this.logger.warn(`Socket ${socket.id} error: ${message}`);
  }
}
