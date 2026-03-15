// src/components/notes/CollaborativeEditor.tsx
import { useEffect, useMemo } from 'react'
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

interface Props {
  noteId: string
  user: {
    name: string
    color: string
  }
  // Initial Tiptap JSON content from GET /notes/:id
  // Applied once on mount to seed the Y.js document
  initialContent?: any
}

export function CollaborativeEditor({ noteId, user, initialContent }: Props) {
  const room = useNoteRoom(noteId)

  // One Y.Doc per note — recreated if noteId changes
  const ydoc = useMemo(() => new Y.Doc(), [noteId])

  // Provider bridges Y.Doc <-> your socket events
  const provider = useMemo(
    () => new NotesYProvider(noteId, ydoc, socket, user),
    [noteId, ydoc],
  )

  // Seed the Y.Doc with the initial content from REST

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
          placeholder: 'Start writing...',
        }),
      ],
      editable: room.canEdit,
      // Seed initial content once the editor is ready
      // Tiptap will apply this into the Y.Doc via the
      // Collaboration extension on first mount
      content: initialContent,
    },
    // Re-run useEditor when canEdit changes (role resolved from server)
    [room.canEdit],
  )

  // Keep editable in sync if role changes mid-session
  // e.g. owner demotes a collaborator while they have the note open
  useEffect(() => {
    if (!editor) return
    editor.setEditable(room.canEdit)
  }, [editor, room.canEdit])

  // Clean up provider on unmount or noteId change
  useEffect(() => {
    return () => provider.destroy()
  }, [provider])

  // ─── Loading states ───────────────────────────────────────────────────────

  if (room.status === 'connecting') {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Joining note...
      </div>
    )
  }

  if (room.status === 'denied') {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        You don't have access to this note.
      </div>
    )
  }

  if (room.status === 'error') {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        Connection error. Please try again.
      </div>
    )
  }

  // ─── Editor ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar only shown to editors and owners */}
      {room.canEdit && (
        <div className="toolbar-slot border-b border-gray-200 px-4 py-2">
            <EditorToolbar editor={editor} />
        </div>
      )}

      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto px-8 py-6 prose max-w-none"
      />
    </div>
  )
}