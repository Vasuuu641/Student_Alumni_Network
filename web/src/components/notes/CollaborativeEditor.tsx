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
import { useNoteRoom } from '../../hooks/useNoteRoom'
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
  onSaveStatusChange?: (status: SaveStatus) => void
}

export function CollaborativeEditor({ noteId, user, initialContent, onSaveStatusChange }: Props) {
  const room = useNoteRoom(noteId)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusRef = useRef<SaveStatus>('idle')

  const setSaveStatus = useCallback((status: SaveStatus) => {
    saveStatusRef.current = status
    onSaveStatusChange?.(status)
  }, [onSaveStatusChange])

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
      editable: room.canEdit,
      content: initialContent,
      onUpdate: ({ editor }) => {
        if (!room.canEdit) return
        // Debounce autosave — 2s after last keystroke
        if (saveTimer.current) clearTimeout(saveTimer.current)
        setSaveStatus('saving')
        saveTimer.current = setTimeout(async () => {
          try {
            const json = editor.getJSON()
            await updateNote(noteId, { content: json })
            setSaveStatus('saved')
            // Reset to idle after 2s so the indicator clears
            setTimeout(() => setSaveStatus('idle'), 2000)
          } catch {
            setSaveStatus('error')
          }
        }, 2000)
      },
    },
    [room.canEdit],
  )

  // Keep editable in sync if role changes mid-session
  useEffect(() => {
    if (!editor) return
    editor.setEditable(room.canEdit)
  }, [editor, room.canEdit])

  // Clean up provider and pending save timer on unmount or noteId change
  useEffect(() => {
    return () => {
      provider.destroy()
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [provider])

  // ─── Loading states ───────────────────────────────────────────────────────

  if (room.status === 'connecting') {
    return (
      <div className="note-canvas note-canvas--state">
        <div className="note-state-msg">Joining note…</div>
      </div>
    )
  }

  if (room.status === 'denied') {
    return (
      <div className="note-canvas note-canvas--state">
        <div className="note-state-msg note-state-msg--error">
          You don't have access to this note.
        </div>
      </div>
    )
  }

  if (room.status === 'error') {
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
      {room.canEdit && (
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