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

  // Provider bridges Y.Doc <-> your socket events
  const provider = useMemo(
    () => new NotesYProvider(noteId, ydoc, socket, user),
    [noteId, ydoc],
  )

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          // Y.js handles undo/redo — disable Tiptap's built-in history
          history: false,
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
      content: initialContent,
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
    [canEdit, persistContent, initialContent],
  )

  useEffect(() => {
    onRegisterFlush?.(flushPendingSave)
  }, [flushPendingSave, onRegisterFlush])

  // Request full state from online peers once we are in the room.
  useEffect(() => {
    provider.setJoined(roomStatus === 'joined')
  }, [provider, roomStatus])

  useEffect(() => {
    if (roomStatus !== 'joined') return
    provider.requestSync()
  }, [roomStatus, provider])

  // Seed from REST content if doc starts empty and no sync update has arrived yet.
  useEffect(() => {
    if (!editor || !initialContent) return
    if (hasSeededInitialContentRef.current) return

    const hasMeaningfulContent = editor.getText().trim().length > 0

    if (!hasMeaningfulContent) {
      editor.commands.setContent(initialContent)
      latestContentRef.current = initialContent
      lastSavedSerializedRef.current = JSON.stringify(initialContent)
    }

    hasSeededInitialContentRef.current = true
  }, [editor, initialContent])

  // Apply server snapshot updates (e.g., restore version) for same note.
  useEffect(() => {
    if (!editor) return
    if (contentVersion === undefined || contentVersion === null) return
    if (lastAppliedContentVersionRef.current === contentVersion) return

    suppressAutosaveNextUpdateRef.current = true
    editor.commands.setContent(initialContent ?? {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    })

    latestContentRef.current = initialContent ?? {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    }
    lastSavedSerializedRef.current = JSON.stringify(latestContentRef.current)
    lastAppliedContentVersionRef.current = contentVersion
  }, [editor, contentVersion, initialContent])

  // Keep editable in sync if role changes mid-session
  useEffect(() => {
    if (!editor) return
    editor.setEditable(canEdit)
  }, [editor, canEdit])

  // Clean up provider and pending save timer on unmount or noteId change
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
      {/* Floating toolbar — only for editors/owners */}
      {canEdit && (
        <div className="note-toolbar">
          <EditorToolbar editor={editor} />
        </div>
      )}

      {/* Paper canvas */}
      <div className="note-scroll-area">
        <div className="note-paper">
          <EditorContent editor={editor} className="note-editor" />
        </div>
      </div>
    </div>
  )
}