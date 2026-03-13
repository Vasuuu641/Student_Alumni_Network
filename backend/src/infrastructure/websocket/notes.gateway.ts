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
import { Server, Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import type { TokenService } from 'src/domain/services/token-service';
import type { NoteRepository } from 'src/domain/repositories/note.repository';
import type { NoteCollaboratorRepository } from 'src/domain/repositories/note-collaborator.repository';
import { NotePermissionRole } from 'src/domain/entities/note.entity';

// Per-socket session data attached after successful authentication
interface SocketSession {
  userId: string;
  role: string;
}

// Room permission resolved per (socket, note)
interface RoomPermission {
  role: NotePermissionRole | 'OWNER';
  canEdit: boolean;
}

@WebSocketGateway({
  cors: { origin: '*' }, // Tighten in production
  namespace: '/notes',
})
export class NotesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotesGateway.name);

  // Track which rooms each socket has joined: socketId -> Set<noteId>
  private socketRooms = new Map<string, Set<string>>();

  // Track room permissions per socket+note: `${socketId}:${noteId}` -> RoomPermission
  private roomPermissions = new Map<string, RoomPermission>();

  constructor(
    @Inject('TokenService') private readonly tokenService: TokenService,
    @Inject('NoteRepository') private readonly noteRepository: NoteRepository,
    @Inject('NoteCollaboratorRepository')
    private readonly noteCollaboratorRepository: NoteCollaboratorRepository,
  ) {}

  // ─── Connection lifecycle ──────────────────────────────────────────────────

  async handleConnection(socket: Socket) {
    try {
      const session = await this.extractAndVerifyToken(socket);
      // Attach session to socket data so handlers can read it
      socket.data.session = session;
      this.socketRooms.set(socket.id, new Set());
      this.logger.log(`Socket connected: ${socket.id} | user: ${session.userId}`);
    } catch {
      // Unauthenticated - disconnect immediately
      this.logger.warn(`Socket rejected (invalid token): ${socket.id}`);
      socket.emit('error', { message: 'Unauthorized: invalid or missing token' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const rooms = this.socketRooms.get(socket.id) ?? new Set();
    for (const noteId of rooms) {
      const roomKey = `notes:${noteId}`;
      // Notify remaining members that this user left
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

  /**
   * notes:join
   * Client requests to join a note collaboration room.
   * Server validates JWT (done at connection) and DB permission before joining.
   */
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

    // Resolve permission from DB
    const permission = await this.resolvePermission(session.userId, noteId);
    if (!permission) {
      return this.emitError(socket, 'Access denied: you do not have access to this note');
    }

    // Join the Socket.IO room
    const roomKey = `notes:${noteId}`;
    await socket.join(roomKey);

    // Track locally
    this.socketRooms.get(socket.id)?.add(noteId);
    this.roomPermissions.set(`${socket.id}:${noteId}`, permission);

    // Acknowledge to joining socket
    socket.emit('notes:joined', {
      noteId,
      role: permission.role,
      canEdit: permission.canEdit,
    });

    // Notify other members of new presence
    socket.to(roomKey).emit('notes:presence', {
      event: 'user-joined',
      userId: session.userId,
      role: permission.role,
    });

    this.logger.log(
      `User ${session.userId} joined note ${noteId} as ${permission.role}`,
    );
  }

  /**
   * notes:leave
   * Client explicitly leaves a room (e.g., closes tab).
   */
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

  /**
   * notes:awareness
   * Broadcasts cursor position / selection state to other room members.
   * Allowed for any role (viewer presence is fine).
   */
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

    // Broadcast cursor/selection state to everyone else in the room
    socket.to(`notes:${noteId}`).emit('notes:awareness', {
      userId: session.userId,
      awarenessState,
    });
  }

  /**
   * notes:crdt-update
   * Client sends a Yjs binary CRDT update.
   * Server validates that the sender has EDITOR or OWNER role, then
   * broadcasts the update to all other room members.
   * The server does NOT store the CRDT state - checkpoints via REST handle persistence.
   */
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

    // Permission check: VIEWERs cannot emit content edits
    const permission = this.roomPermissions.get(`${socket.id}:${noteId}`);
    if (!permission?.canEdit) {
      return this.emitError(socket, 'Access denied: viewers cannot edit note content');
    }

    // Broadcast CRDT update to all other members in the room
    socket.to(`notes:${noteId}`).emit('notes:crdt-update', {
      userId: session.userId,
      update,
    });
  }

  /**
   * notes:checkpoint-created
   * Server-side broadcast triggered after REST checkpoint creation.
   * Informs all room members that a new version checkpoint was saved.
   * Call this from CreateNoteCheckpointUseCase or the controller after a successful save.
   */
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

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async extractAndVerifyToken(socket: Socket): Promise<SocketSession> {
    // Token can be passed as Bearer in auth handshake header OR as query param
    const authHeader = socket.handshake.headers?.authorization as string;
    const queryToken = socket.handshake.query?.token as string;

    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (queryToken) {
      token = queryToken;
    }

    if (!token) {
      throw new Error('No token provided');
    }

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

    // Owner has full access
    if (note.ownerId === userId) {
      return { role: NotePermissionRole.OWNER, canEdit: true };
    }

    // Check collaborator table
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
}
