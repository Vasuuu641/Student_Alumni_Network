// src/lib/notes-y-provider.ts
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import { Socket } from 'socket.io-client'

export class NotesYProvider {
  awareness: awarenessProtocol.Awareness

  constructor(
    private noteId: string,
    private doc: Y.Doc,
    private socket: Socket,
    public user: { name: string; color: string },
  ) {
    this.awareness = new awarenessProtocol.Awareness(doc)

    // Set this client's user info so other clients can render
    // their cursor/presence with the correct name and color
    this.awareness.setLocalStateField('user', user)

    // Register listeners
    this.doc.on('update', this.onDocUpdate)
    this.awareness.on('update', this.onAwarenessUpdate)
    this.socket.on('notes:crdt-update', this.onRemoteCrdtUpdate)
    this.socket.on('notes:awareness', this.onRemoteAwareness)
  }

  // ─── Outgoing ──────────────────────────────────────────────────────────────

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    // Skip updates that originated from the socket itself
    // to avoid rebroadcasting what we just received
    if (origin === this) return

    this.socket.emit('notes:crdt-update', {
      noteId: this.noteId,
      update: Array.from(update),
    })
  }

  private onAwarenessUpdate = ({
    added,
    updated,
    removed,
  }: {
    added: number[]
    updated: number[]
    removed: number[]
  }) => {
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
    update,
  }: {
    userId: string
    update: number[]
  }) => {
    // Apply with `this` as origin so onDocUpdate doesn't
    // re-broadcast it back to the server
    Y.applyUpdate(this.doc, new Uint8Array(update), this)
  }

  private onRemoteAwareness = ({
    awarenessState,
  }: {
    userId: string
    awarenessState: number[]
  }) => {
    awarenessProtocol.applyAwarenessUpdate(
      this.awareness,
      new Uint8Array(awarenessState),
      this,
    )
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  destroy() {
    this.doc.off('update', this.onDocUpdate)
    this.awareness.off('update', this.onAwarenessUpdate)
    this.socket.off('notes:crdt-update', this.onRemoteCrdtUpdate)
    this.socket.off('notes:awareness', this.onRemoteAwareness)
    this.awareness.destroy()
  }
}