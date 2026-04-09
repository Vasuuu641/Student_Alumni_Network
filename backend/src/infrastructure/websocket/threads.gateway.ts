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
import type { ThreadRepository } from 'src/domain/repositories/thread.repository';
import { ThreadsRealtimePublisher, type VoteBroadcastPayload } from 'src/domain/services/threads-realtime-publisher';
import { ThreadReply } from 'src/domain/entities/thread.entity';
import type { ThreadLLMService } from 'src/domain/services/thread-llm.service';
import { ThreadPanel } from 'src/domain/entities/thread.entity';
import { Role } from 'src/domain/entities/authorized-user.entity';

interface SocketSession {
  userId: string;
  role: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/threads',
})
export class ThreadsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, ThreadsRealtimePublisher
{
  @WebSocketServer()
  server: Namespace;

  private readonly logger = new Logger(ThreadsGateway.name);
  private socketRooms = new Map<string, Set<string>>();

  constructor(
    @Inject('TokenService') private readonly tokenService: TokenService,
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
    @Inject('ThreadLLMService') private readonly threadLLMService: ThreadLLMService,
  ) {}

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(socket: Socket) {
    try {
      const session = await this.extractAndVerifyToken(socket);
      socket.data.session = session;
      this.socketRooms.set(socket.id, new Set());
      this.logger.log(`Socket connected: ${socket.id} | user: ${session.userId}`);
    } catch {
      this.logger.warn(`Socket rejected (invalid token): ${socket.id}`);
      socket.emit('error', { message: 'Unauthorized: invalid or missing token' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const rooms = this.socketRooms.get(socket.id) ?? new Set();
    for (const threadId of rooms) {
      socket.to(`threads:${threadId}`).emit('threads:presence', {
        event: 'user-left',
        userId: socket.data.session?.userId,
      });
    }
    this.socketRooms.delete(socket.id);
    this.logger.log(`Socket disconnected: ${socket.id}`);
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  @SubscribeMessage('threads:join')
  async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { threadId: string },
  ) {
    const { threadId } = data;
    const session: SocketSession = socket.data.session;

    if (!session) {
      return this.emitError(socket, 'Unauthorized');
    }

    const thread = await this.threadRepository.findById(threadId);
    if (!thread) {
      return this.emitError(socket, `Thread ${threadId} not found`);
    }

    const roomKey = `threads:${threadId}`;
    await socket.join(roomKey);
    this.socketRooms.get(socket.id)?.add(threadId);

    socket.emit('threads:joined', {
      threadId,
      userId: session.userId,
    });

    socket.to(roomKey).emit('threads:presence', {
      event: 'user-joined',
      userId: session.userId,
    });

    this.logger.log(`User ${session.userId} joined thread ${threadId}`);
  }

  @SubscribeMessage('threads:leave')
  async handleLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { threadId: string },
  ) {
    const { threadId } = data;
    const session: SocketSession = socket.data.session;
    const roomKey = `threads:${threadId}`;

    await socket.leave(roomKey);
    this.socketRooms.get(socket.id)?.delete(threadId);

    socket.to(roomKey).emit('threads:presence', {
      event: 'user-left',
      userId: session?.userId,
    });

    socket.emit('threads:left', { threadId });
    this.logger.log(`User ${session?.userId} left thread ${threadId}`);
  }

    @SubscribeMessage('threads:typing-similarity')
    async handleTypingSimilarity(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { query: string; panel: ThreadPanel },
    ) {
    const session: SocketSession = socket.data.session;

    if (!session) {
        return this.emitError(socket, 'Unauthorized');
    }

    // Must be at least 10 characters before we bother calling Cohere
    if (!data.query || data.query.trim().length < 10) {
        socket.emit('threads:similarity-results', { results: [] });
        return;
    }

    try {
        // Respect panel access — ACADEMIC users only see ACADEMIC results
        const userRole = session.role as Role;
        const panelFilter = userRole === Role.ALUMNI
        ? null  // alumni can see both panels
        : data.panel === ThreadPanel.ACADEMIC
        ? ThreadPanel.ACADEMIC  // students/professors searching academic only see academic
        : null;

        const results = await this.threadLLMService.findSimilarThreads(
        data.query.trim(),
        panelFilter,
        5,
        0.65,
        );

        socket.emit('threads:similarity-results', { results });
        this.logger.log(
        `Similarity search: user=${session.userId} query="${data.query.trim()}" results=${results.length}`,
        );
    } catch (error) {
        this.logger.error(`Similarity search failed: ${error.message}`);
        // Don't emit error to client — just return empty results silently
        socket.emit('threads:similarity-results', { results: [] });
    }
    }

  // ─── Server-side broadcasts ───────────────────────────────────────────────

  broadcastReplyPosted(threadId: string, reply: ThreadReply): void {
    this.server.to(`threads:${threadId}`).emit('threads:reply-posted', {
      threadId,
      reply,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Reply broadcast: thread ${threadId} reply ${reply.id}`);
  }

  broadcastReplyEdited(threadId: string, replyId: string, content: string): void {
    this.server.to(`threads:${threadId}`).emit('threads:reply-edited', {
      threadId,
      replyId,
      content,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Reply edited broadcast: thread ${threadId} reply ${replyId}`);
  }

  broadcastReplyDeleted(threadId: string, replyId: string): void {
    this.server.to(`threads:${threadId}`).emit('threads:reply-deleted', {
      threadId,
      replyId,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Reply deleted broadcast: thread ${threadId} reply ${replyId}`);
  }

  broadcastThreadVoted(threadId: string, payload: VoteBroadcastPayload): void {
    this.server.to(`threads:${threadId}`).emit('threads:thread-voted', {
      threadId,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastReplyVoted(threadId: string, replyId: string, payload: VoteBroadcastPayload): void {
    this.server.to(`threads:${threadId}`).emit('threads:reply-voted', {
      threadId,
      replyId,
      ...payload,
      timestamp: new Date().toISOString(),
    });
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

  private isInRoom(socket: Socket, threadId: string): boolean {
    return this.socketRooms.get(socket.id)?.has(threadId) ?? false;
  }

  private emitError(socket: Socket, message: string) {
    socket.emit('error', { message });
    this.logger.warn(`Socket ${socket.id} error: ${message}`);
  }
}