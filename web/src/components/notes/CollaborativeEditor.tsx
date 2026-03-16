// src/components/notes/CollaborativeEditor.tsx
import { useEffect, useMemo, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Placeholder from '@tiptap/extension-placeholder'
import * as Y from 'yjs'
import { socket } from '../../lib/socket'
import { NotesYProvider } from '../../lib/notes-y-provider'
import { EditorToolbar } from './EditorToolbar'
import { updateNote } from '../../api/notes.api'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  noteId: string
  user: {
    name: string
    color: string
  }
  initialContent?: any
  contentVersion?: number | null
  roomStatus: 'connecting' | 'joined' | 'denied' | 'error'
  canEdit: boolean
  onSaveStatusChange?: (status: SaveStatus) => void
  onRegisterFlush?: (flush: () => Promise<void>) => void
}

export function CollaborativeEditor({
  noteId,
  user,
  initialContent,
  contentVersion,
  roomStatus,
  canEdit,
  onSaveStatusChange,
  onRegisterFlush,
}: Props) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasSeededInitialContentRef = useRef(false)

  useEffect(() => {
    hasSeededInitialContentRef.current = false
  }, [noteId])

  const latestContentRef = useRef<any>(initialContent ?? null)
  const lastSavedSerializedRef = useRef<string>(
    JSON.stringify(initialContent ?? null),
  )
  const inFlightSaveRef = useRef(false)
  const hasPendingSaveRef = useRef(false)
  const pendingContentRef = useRef<any>(null)
  const lastAppliedContentVersionRef = useRef<number | null>(null)
  const suppressAutosaveNextUpdateRef = useRef(false)

  const setSaveStatus = useCallback((status: SaveStatus) => {
    onSaveStatusChange?.(status)
  }, [onSaveStatusChange])

  const persistContent = useCallback(
    async (content: any) => {
      if (!canEdit) return

      const serialized = JSON.stringify(content ?? null)
      if (serialized === lastSavedSerializedRef.current) return
      if (inFlightSaveRef.current) {
        hasPendingSaveRef.current = true
        pendingContentRef.current = content
        return
      }

      inFlightSaveRef.current = true
      setSaveStatus('saving')
      try {
        await updateNote(noteId, { content })
        lastSavedSerializedRef.current = serialized
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 1200)
      } catch {
        setSaveStatus('error')
      } finally {
        inFlightSaveRef.current = false
        if (hasPendingSaveRef.current) {
          hasPendingSaveRef.current = false
          const pendingContent = pendingContentRef.current
          pendingContentRef.current = null
          await persistContent(pendingContent)
        }
      }
    },
    [noteId, canEdit, setSaveStatus],
  )

  const flushPendingSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    await persistContent(latestContentRef.current)
  }, [persistContent])

  // One Y.Doc per note — recreated if noteId changes
  const ydoc = useMemo(() => new Y.Doc(), [noteId])

  // Provider bridges Y.Doc <-> socket events
  // Fix 8 — user is now a stable memoized object from NotePage
  // so this never recreates unnecessarily
  const provider = useMemo(
    () => new NotesYProvider(noteId, ydoc, socket, user),
    [noteId, ydoc],
  )

  // Fix 10 — only [canEdit] as dependency
  // Removing persistContent and initialContent prevents the editor
  // from remounting every time autosave state or fetched content changes,
  // which was destroying the Y.js <-> editor binding mid-session
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false, // Y.js handles undo/redo
        }),
        Collaboration.configure({
          document: ydoc,
        }),
        CollaborationCursor.configure({
          provider,
          user: { name: user.name, color: user.color },
        }),
        Placeholder.configure({
          placeholder: 'Start writing…',
        }),
      ],
      editable: canEdit,
      onUpdate: ({ editor }) => {
        if (suppressAutosaveNextUpdateRef.current) {
          suppressAutosaveNextUpdateRef.current = false
          latestContentRef.current = editor.getJSON()
          return
        }

        latestContentRef.current = editor.getJSON()
        if (!canEdit) return

        // Debounce autosave — 2s after last keystroke
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(async () => {
          await persistContent(latestContentRef.current)
        }, 2000)
      },
    },
    [canEdit], // Fix 10 — only re-run when editability changes
  )

  useEffect(() => {
    onRegisterFlush?.(flushPendingSave)
  }, [flushPendingSave, onRegisterFlush])

  // Inform provider whether we are actively in the room
  // so it gates outgoing CRDT broadcasts correctly
  useEffect(() => {
    provider.setJoined(roomStatus === 'joined')
  }, [provider, roomStatus])

  // Request full Y.js state from online peers once joined
  useEffect(() => {
    if (roomStatus !== 'joined') return
    provider.requestSync()
  }, [roomStatus, provider])

  // Fix 11 — seed from REST content only after room is joined
  // and only if the Y.js doc is still empty (no peer sync arrived yet)
  useEffect(() => {
    if (roomStatus !== 'joined') return   // Fix 11 — guard added
    if (!editor || !initialContent) return
    if (hasSeededInitialContentRef.current) return

    const hasMeaningfulContent = editor.getText().trim().length > 0

    if (!hasMeaningfulContent) {
      editor.commands.setContent(initialContent)
      latestContentRef.current = initialContent
      lastSavedSerializedRef.current = JSON.stringify(initialContent)
    }

    hasSeededInitialContentRef.current = true
  }, [editor, initialContent, roomStatus]) // Fix 11 — roomStatus added to deps

  // Fix 4/16 — apply restored content when contentVersion bumps
  // contentVersion is a local counter incremented by NotePage after
  // a restore, not latestVersionNumber from the backend (which was always null)
  useEffect(() => {
    if (!editor) return
    if (contentVersion === undefined || contentVersion === null) return
    if (contentVersion === 0) return  // 0 is the initial value, not a restore
    if (lastAppliedContentVersionRef.current === contentVersion) return

    suppressAutosaveNextUpdateRef.current = true
    editor.commands.setContent(
      initialContent ?? { type: 'doc', content: [{ type: 'paragraph' }] }
    )

    latestContentRef.current =
      initialContent ?? { type: 'doc', content: [{ type: 'paragraph' }] }
    lastSavedSerializedRef.current = JSON.stringify(latestContentRef.current)
    lastAppliedContentVersionRef.current = contentVersion
  }, [editor, contentVersion, initialContent])

  // Keep editable in sync if role changes mid-session
  // e.g. owner demotes a collaborator while they have the note open
  useEffect(() => {
    if (!editor) return
    editor.setEditable(canEdit)
  }, [editor, canEdit])

  // Flush pending save on tab hide and clean up on unmount
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushPendingSave()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      provider.destroy()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void flushPendingSave()
    }
  }, [provider, flushPendingSave])

  // ─── Loading states ───────────────────────────────────────────────────────

  if (roomStatus === 'connecting') {
    return (
      <div className="note-canvas note-canvas--state">
        <div className="note-state-msg">Joining note…</div>
      </div>
    )
  }

  if (roomStatus === 'denied') {
    return (
      <div className="note-canvas note-canvas--state">
        <div className="note-state-msg note-state-msg--error">
          You don't have access to this note.
        </div>
      </div>
    )
  }

  if (roomStatus === 'error') {
    return (
      <div className="note-canvas note-canvas--state">
        <div className="note-state-msg note-state-msg--error">
          Connection error. Please try again.
        </div>
      </div>
    )
  }

  // ─── Editor ───────────────────────────────────────────────────────────────

  return (
    <div className="note-canvas">
      {canEdit && (
        <div className="note-toolbar">
          <EditorToolbar editor={editor} />
        </div>
      )}

      <div className="note-scroll-area">
        <div className="note-paper">
          <EditorContent editor={editor} className="note-editor" />
        </div>
      </div>
    </div>
  )
}