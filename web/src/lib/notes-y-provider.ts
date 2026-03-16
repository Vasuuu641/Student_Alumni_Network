// src/lib/notes-y-provider.ts
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import { Socket } from 'socket.io-client'

export class NotesYProvider {
  awareness: awarenessProtocol.Awareness
  private hasRequestedSync = false
  private isJoined = false

  constructor(
    private noteId: string,
    private doc: Y.Doc,
    private socket: Socket,
    public user: { name: string; color: string },
  ) {
    this.awareness = new awarenessProtocol.Awareness(doc)

    // Register listeners
    this.doc.on('update', this.onDocUpdate)
    this.awareness.on('update', this.onAwarenessUpdate)
    this.socket.on('notes:crdt-update', this.onRemoteCrdtUpdate)
    this.socket.on('notes:awareness', this.onRemoteAwareness)
    this.socket.on('notes:sync-request', this.onSyncRequest)
    this.socket.on('notes:sync-response', this.onSyncResponse)
    this.socket.on(
      'notes:awareness-rebroadcast-request',
      this.onAwarenessRebroadcastRequest,
    )

    // Set this client's user info after listener registration so
    // the initial awareness update is emitted to collaborators.
    this.awareness.setLocalStateField('user', user)
  }

  // ─── Outgoing ──────────────────────────────────────────────────────────────

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (!this.isJoined) return
    if (origin === this) return

    this.socket.emit('notes:crdt-update', {
      noteId: this.noteId,
      update: Array.from(update),
    })
  }

  private onAwarenessUpdate = (
    {
      added,
      updated,
      removed,
    }: {
      added: number[]
      updated: number[]
      removed: number[]
    },
    origin: unknown,
  ) => {
    if (!this.isJoined) return
    if (origin === this) return

    const changedClients = [...added, ...updated, ...removed]
    const encoded = awarenessProtocol.encodeAwarenessUpdate(
      this.awareness,
      changedClients,
    )
    this.socket.emit('notes:awareness', {
      noteId: this.noteId,
      awarenessState: Array.from(encoded),
    })
  }

  // ─── Incoming ──────────────────────────────────────────────────────────────

  private onRemoteCrdtUpdate = ({
    noteId,
    update,
  }: {
    noteId?: string
    userId: string
    update: number[]
  }) => {
    if (noteId && noteId !== this.noteId) return
    Y.applyUpdate(this.doc, new Uint8Array(update), this)
  }

  private onRemoteAwareness = ({
    noteId,
    awarenessState,
  }: {
    noteId?: string
    userId: string
    awarenessState: number[]
  }) => {
    if (noteId && noteId !== this.noteId) return

    awarenessProtocol.applyAwarenessUpdate(
      this.awareness,
      new Uint8Array(awarenessState),
      this,
    )
  }

  private onSyncRequest = ({
    noteId,
    requesterSocketId,
  }: {
    noteId: string
    requesterSocketId: string
  }) => {
    if (noteId !== this.noteId) return

    const fullUpdate = Y.encodeStateAsUpdate(this.doc)
    this.socket.emit('notes:sync-response', {
      noteId: this.noteId,
      requesterSocketId,
      update: Array.from(fullUpdate),
    })

    this.emitCurrentAwareness()
  }

  private onSyncResponse = ({
    noteId,
    update,
  }: {
    noteId: string
    update: number[]
    fromSocketId: string
  }) => {
    if (noteId !== this.noteId) return
    Y.applyUpdate(this.doc, new Uint8Array(update), this)
  }

  requestSync() {
    if (this.hasRequestedSync) return
    this.hasRequestedSync = true
    this.socket.emit('notes:sync-request', { noteId: this.noteId })
  }

  setJoined(joined: boolean) {
    this.isJoined = joined
    if (joined) {
      this.emitCurrentAwareness()
    }
  }

  private onAwarenessRebroadcastRequest = ({ noteId }: { noteId: string }) => {
    if (noteId !== this.noteId) return
    this.emitCurrentAwareness()
  }

  // Fix 12 — always include the local client ID so awareness is
  // broadcast even when the user hasn't moved their cursor yet.
  // Previously if getStates() was empty nothing was emitted, meaning
  // newly joined users never received cursor state from existing members.
  private emitCurrentAwareness() {
    const localClientId = this.doc.clientID
    const allClientIds = Array.from(
      new Set([localClientId, ...this.awareness.getStates().keys()])
    )

    const encoded = awarenessProtocol.encodeAwarenessUpdate(
      this.awareness,
      allClientIds,
    )

    this.socket.emit('notes:awareness', {
      noteId: this.noteId,
      awarenessState: Array.from(encoded),
    })
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  destroy() {
    this.doc.off('update', this.onDocUpdate)
    this.awareness.off('update', this.onAwarenessUpdate)
    this.socket.off('notes:crdt-update', this.onRemoteCrdtUpdate)
    this.socket.off('notes:awareness', this.onRemoteAwareness)
    this.socket.off('notes:sync-request', this.onSyncRequest)
    this.socket.off('notes:sync-response', this.onSyncResponse)
    this.socket.off(
      'notes:awareness-rebroadcast-request',
      this.onAwarenessRebroadcastRequest,
    )
    this.awareness.destroy()
  }
}