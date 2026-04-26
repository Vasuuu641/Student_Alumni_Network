// Notes WebSocket Gateway - Phase 5
// Handles real-time collaborative editing transport.
// Room key pattern: notes:{noteId}
// CRDT updates (Yjs) are passed through server to other room members.
// Server enforces JWT auth and note permission on every join.

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
import type { NoteRepository } from 'src/domain/repositories/note.repository';
import type { NoteCollaboratorRepository } from 'src/domain/repositories/note-collaborator.repository';
import type { UserRepository } from 'src/domain/repositories/user.repository';
import { NotePermissionRole } from 'src/domain/entities/note.entity';

import type { NoteLLMService } from 'src/domain/services/note-llm-service';

interface SocketSession {
  userId: string;
  role: string;
}

interface PresenceIdentity {
  email: string | null;
  displayName: string;
}

interface RoomPermission {
  role: NotePermissionRole | 'OWNER';
  canEdit: boolean;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notes',
})
export class NotesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Namespace;

  private readonly logger = new Logger(NotesGateway.name);

  private socketRooms = new Map<string, Set<string>>();
  private roomPermissions = new Map<string, RoomPermission>();

  constructor(
    @Inject('TokenService') private readonly tokenService: TokenService,
    @Inject('NoteRepository') private readonly noteRepository: NoteRepository,
    @Inject('NoteCollaboratorRepository')
    private readonly noteCollaboratorRepository: NoteCollaboratorRepository,
    @Inject('UserRepository') private readonly userRepository: UserRepository,
    @Inject('NoteLLMService') private readonly noteLLMService: NoteLLMService,
  ) {}

  // ─── Connection lifecycle ──────────────────────────────────────────────────

  async handleConnection(socket: Socket) {
    try {
      const session = await this.extractAndVerifyToken(socket);
      socket.data.session = session;
      socket.data.identity = await this.resolvePresenceIdentity(session.userId);
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
    for (const noteId of rooms) {
      const roomKey = `notes:${noteId}`;
      socket.to(roomKey).emit('notes:presence', {
        event: 'user-left',
        userId: socket.data.session?.userId,
      });
      this.roomPermissions.delete(`${socket.id}:${noteId}`);
    }
    this.socketRooms.delete(socket.id);
    this.logger.log(`Socket disconnected: ${socket.id}`);
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  @SubscribeMessage('notes:join')
  async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { noteId: string },
  ) {
    const { noteId } = data;
    const session: SocketSession = socket.data.session;

    if (!session) {
      return this.emitError(socket, 'Unauthorized');
    }

    const permission = await this.resolvePermission(session.userId, noteId);
    if (!permission) {
      return this.emitError(socket, 'Access denied: you do not have access to this note');
    }

    const roomKey = `notes:${noteId}`;
    await socket.join(roomKey);
    const identity =
      (socket.data.identity as PresenceIdentity | undefined) ??
      ({ email: null, displayName: session.userId } as PresenceIdentity);

    this.socketRooms.get(socket.id)?.add(noteId);
    this.roomPermissions.set(`${socket.id}:${noteId}`, permission);

    socket.emit('notes:joined', {
      noteId,
      role: permission.role,
      canEdit: permission.canEdit,
      userId: session.userId,
      email: identity.email,
      displayName: identity.displayName,
    });

    const users = Array.from(this.socketRooms.entries())
      .filter(([memberSocketId, noteIds]) => memberSocketId !== socket.id && noteIds.has(noteId))
      .map(([memberSocketId]) => memberSocketId)
      .map((socketId) => {
        const memberSocket = this.server.sockets.get(socketId);
        const memberSession = memberSocket?.data?.session as SocketSession | undefined;
        const memberIdentity = memberSocket?.data?.identity as PresenceIdentity | undefined;
        const memberPermission = this.roomPermissions.get(`${socketId}:${noteId}`);

        if (!memberSession || !memberPermission) return null;

        return {
          userId: memberSession.userId,
          role: memberPermission.role,
          email: memberIdentity?.email ?? null,
          displayName: memberIdentity?.displayName ?? memberSession.userId,
        };
      })
      .filter((item): item is {
        userId: string;
        role: NotePermissionRole | 'OWNER';
        email: string | null;
        displayName: string;
      } => item !== null);

    socket.emit('notes:presence-snapshot', { noteId, users });

    socket.to(roomKey).emit('notes:awareness-rebroadcast-request', { noteId });

    socket.to(roomKey).emit('notes:presence', {
      event: 'user-joined',
      userId: session.userId,
      role: permission.role,
      email: identity.email,
      displayName: identity.displayName,
    });

    this.logger.log(`User ${session.userId} joined note ${noteId} as ${permission.role}`);
  }

  @SubscribeMessage('notes:leave')
  async handleLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { noteId: string },
  ) {
    const { noteId } = data;
    const session: SocketSession = socket.data.session;
    const roomKey = `notes:${noteId}`;

    await socket.leave(roomKey);
    this.socketRooms.get(socket.id)?.delete(noteId);
    this.roomPermissions.delete(`${socket.id}:${noteId}`);

    socket.to(roomKey).emit('notes:presence', {
      event: 'user-left',
      userId: session?.userId,
    });

    socket.emit('notes:left', { noteId });
    this.logger.log(`User ${session?.userId} left note ${noteId}`);
  }

  @SubscribeMessage('notes:awareness')
  handleAwareness(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { noteId: string; awarenessState: any },
  ) {
    const { noteId, awarenessState } = data;
    const session: SocketSession = socket.data.session;

    if (!this.isInRoom(socket, noteId)) {
      return this.emitError(socket, 'Join the note room first');
    }

    socket.to(`notes:${noteId}`).emit('notes:awareness', {
      noteId,
      userId: session.userId,
      awarenessState,
    });
  }

  @SubscribeMessage('notes:sync-request')
  handleSyncRequest(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { noteId: string },
  ) {
    const { noteId } = data;

    if (!this.isInRoom(socket, noteId)) {
      return this.emitError(socket, 'Join the note room first');
    }

    socket.to(`notes:${noteId}`).emit('notes:sync-request', {
      noteId,
      requesterSocketId: socket.id,
    });
  }

  @SubscribeMessage('notes:sync-response')
  handleSyncResponse(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { noteId: string; requesterSocketId: string; update: any },
  ) {
    const { noteId, requesterSocketId, update } = data;

    if (!this.isInRoom(socket, noteId)) {
      return this.emitError(socket, 'Join the note room first');
    }

    this.server.to(requesterSocketId).emit('notes:sync-response', {
      noteId,
      update,
      fromSocketId: socket.id,
    });
  }

  @SubscribeMessage('notes:crdt-update')
  handleCrdtUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { noteId: string; update: any },
  ) {
    const { noteId, update } = data;
    const session: SocketSession = socket.data.session;

    if (!this.isInRoom(socket, noteId)) {
      return this.emitError(socket, 'Join the note room first');
    }

    const permission = this.roomPermissions.get(`${socket.id}:${noteId}`);
    if (!permission?.canEdit) {
      return this.emitError(socket, 'Access denied: viewers cannot edit note content');
    }

    socket.to(`notes:${noteId}`).emit('notes:crdt-update', {
      noteId,
      userId: session.userId,
      update,
    });
  }

  // Deprecated: kept to prevent token burn from legacy clients that emit on each keystroke.
  // Cohere is only called from `notes:request-related-threads`.
  @SubscribeMessage('notes:typing-related-threads')
  handleTypingRelatedThreads(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { noteId: string },
  ) {
    const session: SocketSession = socket.data.session;

    if (!session) {
      return this.emitError(socket, 'Unauthorized');
    }

    if (!this.isInRoom(socket, data.noteId)) {
      return this.emitError(socket, 'Join the note room first');
    }

    socket.emit('notes:related-threads', {
      noteId: data.noteId,
      results: [],
      mode: 'manual-request-required',
    });

    this.logger.debug(
      `Ignored legacy typing-related-threads event: user=${session.userId} note=${data.noteId}`,
    );
  }

  @SubscribeMessage('notes:request-related-threads')
  async handleRequestRelatedThreads(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { noteId: string; title: string; contentJson: unknown },
  ) {
    const session: SocketSession = socket.data.session;

    if (!session) {
      return this.emitError(socket, 'Unauthorized');
    }

    if (!this.isInRoom(socket, data.noteId)) {
      return this.emitError(socket, 'Join the note room first');
    }

    // Need at least 20 chars of combined content before searching
    const bodyText = data.title + ' ' + JSON.stringify(data.contentJson ?? '');
    if (bodyText.trim().length < 20) {
      socket.emit('notes:related-threads', { noteId: data.noteId, results: [] });
      return;
    }

    try {
      const results = await this.noteLLMService.findRelatedThreads(
        data.title,
        data.contentJson,
        5,
        0.55,
      );

      socket.emit('notes:related-threads', {
        noteId: data.noteId,
        results,
      });

      this.logger.log(
        `Related threads search (manual): user=${session.userId} note=${data.noteId} results=${results.length}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Related threads search failed: ${errorMessage}`);
      socket.emit('notes:related-threads', { noteId: data.noteId, results: [] });
    }
  }

  // ─── Server-side broadcasts ───────────────────────────────────────────────

  broadcastCheckpointCreated(noteId: string, actorId: string, versionNumber: number) {
    this.server.to(`notes:${noteId}`).emit('notes:checkpoint-created', {
      noteId,
      actorId,
      versionNumber,
      createdAt: new Date().toISOString(),
    });
    this.logger.log(
      `Checkpoint broadcast: note ${noteId} version ${versionNumber} by ${actorId}`,
    );
  }

  // Broadcasts restored content to all collaborators so their editors
  // re-seed without requiring a page refresh
  broadcastVersionRestored(noteId: string, actorId: string, content: unknown) {
    this.server.to(`notes:${noteId}`).emit('notes:version-restored', {
      noteId,
      actorId,
      content,
    });
    this.logger.log(`Version restored broadcast: note ${noteId} by ${actorId}`);
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

  private async resolvePermission(
    userId: string,
    noteId: string,
  ): Promise<RoomPermission | null> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) return null;

    if (note.ownerId === userId) {
      return { role: NotePermissionRole.OWNER, canEdit: true };
    }

    const collaborator = await this.noteCollaboratorRepository.findByNoteAndUser(
      noteId,
      userId,
    );
    if (!collaborator) return null;

    const canEdit = collaborator.role === NotePermissionRole.EDITOR;
    return { role: collaborator.role, canEdit };
  }

  private isInRoom(socket: Socket, noteId: string): boolean {
    return this.socketRooms.get(socket.id)?.has(noteId) ?? false;
  }

  private emitError(socket: Socket, message: string) {
    socket.emit('error', { message });
    this.logger.warn(`Socket ${socket.id} error: ${message}`);
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
}