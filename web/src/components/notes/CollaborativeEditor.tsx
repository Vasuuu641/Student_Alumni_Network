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
import { updateNote, updateNoteKeepalive } from '../../api/notes.api'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import FontFamily from '@tiptap/extension-font-family'
import TextStyle from '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'

//custom font size extension 
const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize || null,
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {}
              }
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any
  },
})

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  noteId: string
  user: {
    name: string
    color: string
  }
  initialContent?: any
  peerCount?: number
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
  peerCount = 0,
  contentVersion,
  roomStatus,
  canEdit,
  onSaveStatusChange,
  onRegisterFlush,
}: Props) {
  const PAGE_CHAR_LIMIT = 2200
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasSeededInitialContentRef = useRef(false)
  const autosaveArmedRef = useRef(false)
  const autoPageBreakInProgressRef = useRef(false)
  const autoInsertedPageCountRef = useRef(0)
  const previousTextLengthRef = useRef(0)

  useEffect(() => {
    hasSeededInitialContentRef.current = false
    autosaveArmedRef.current = false
    autoPageBreakInProgressRef.current = false
    autoInsertedPageCountRef.current = 0
    previousTextLengthRef.current = 0
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

  // Refs to keep onUpdate closure always fresh without
  // needing canEdit or persistContent in useEditor deps.
  // Without these, onUpdate captures stale values from the
  // first render and either never saves or saves empty content.
  const canEditRef = useRef(canEdit)
  useEffect(() => {
    canEditRef.current = canEdit
  }, [canEdit])

  const setSaveStatus = useCallback((status: SaveStatus) => {
    onSaveStatusChange?.(status)
  }, [onSaveStatusChange])

  const persistContent = useCallback(
    async (content: any) => {
      if (!canEdit) return
      if (!autosaveArmedRef.current) return

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

  // Always-fresh ref so onUpdate never calls a stale persistContent.
  // This is the core fix for empty content being saved — the onUpdate
  // closure was calling the version of persistContent from the first
  // render which had canEdit=false and noteId from initial mount.
  const persistContentRef = useRef(persistContent)
  useEffect(() => {
    persistContentRef.current = persistContent
  }, [persistContent])

  const persistContentKeepalive = useCallback((content: any) => {
    if (!canEditRef.current) return
    if (!autosaveArmedRef.current) return

    const serialized = JSON.stringify(content ?? null)
    if (serialized === lastSavedSerializedRef.current) return

    updateNoteKeepalive(noteId, { content })
    lastSavedSerializedRef.current = serialized
  }, [noteId])

  const waitForSaveQueueToDrain = useCallback(async () => {
    while (inFlightSaveRef.current || hasPendingSaveRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }, [])

  // flushPendingSave no longer depends on persistContent directly —
  // it calls through the ref so it's a stable reference that never
  // changes, which stops the visibilitychange effect from re-running
  const flushPendingSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    await persistContentRef.current(latestContentRef.current)
    await waitForSaveQueueToDrain()
  }, [waitForSaveQueueToDrain])

  const maybeInsertAutoPageBreak = useCallback((editorInstance: any) => {
    if (!canEditRef.current) return
    if (!autosaveArmedRef.current) return
    if (peerCount > 0) return
    if (autoPageBreakInProgressRef.current) return

    const textLength = editorInstance.getText().length
    const previousLength = previousTextLengthRef.current
    previousTextLengthRef.current = textLength

    // Skip large jumps from hydration/sync; only react to normal typing growth.
    if (Math.abs(textLength - previousLength) > 80) return
    if (textLength < PAGE_CHAR_LIMIT) return

    const requiredBreaks = Math.floor(textLength / PAGE_CHAR_LIMIT)
    if (requiredBreaks <= autoInsertedPageCountRef.current) return

    const buildBlankPageSpacer = () => [
      { type: 'horizontalRule' as const },
      ...Array.from({ length: 20 }, () => ({ type: 'paragraph' as const })),
    ]

    autoPageBreakInProgressRef.current = true
    autoInsertedPageCountRef.current = requiredBreaks
    const endPos = editorInstance.state.doc.content.size
    editorInstance
      .chain()
      .focus('end')
      .insertContentAt(endPos, buildBlankPageSpacer())
      .focus('end')
      .run()

    setTimeout(() => {
      autoPageBreakInProgressRef.current = false
    }, 0)
  }, [peerCount, PAGE_CHAR_LIMIT])

  // One Y.Doc per note — recreated if noteId changes
  const ydoc = useMemo(() => new Y.Doc(), [noteId])

  // Provider bridges Y.Doc <-> socket events
  const provider = useMemo(
    () => new NotesYProvider(noteId, ydoc, socket, user),
    [noteId, ydoc],
  )

  // Empty deps — editor never remounts.
  // All state is managed via refs and effects below.
  // Previously [canEdit] caused the editor to remount when the room
  // joined (canEdit flipped from false to true), which destroyed the
  // Y.js fragment binding and broke live collaboration.
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
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
        TextAlign.configure({
          types: ['paragraph', 'heading'],
        }),
        Highlight.configure({
          multicolor: true,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
        }),
        FontFamily,
        TextStyle,
        FontSize
      ],
      editable: false, // setEditable effect handles this
      onUpdate: ({ editor }) => {
        const snapshot = editor.getJSON()

        if (suppressAutosaveNextUpdateRef.current) {
          suppressAutosaveNextUpdateRef.current = false
          latestContentRef.current = snapshot
          return
        }

        // Read from ref so this closure is never stale
        if (!canEditRef.current) return
        if (!autosaveArmedRef.current) {
          if (editor.getText().trim().length > 0) {
            latestContentRef.current = snapshot
          }
          return
        }

        latestContentRef.current = snapshot

        maybeInsertAutoPageBreak(editor)

        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(async () => {
          // Call through ref so we always use the latest persistContent
          await persistContentRef.current(latestContentRef.current)
        }, 500)
      },
    },
    [], // empty — never remount
  )

  useEffect(() => {
    onRegisterFlush?.(flushPendingSave)
  }, [flushPendingSave, onRegisterFlush])

  // Inform provider whether we are actively in the room
  useEffect(() => {
    provider.setJoined(roomStatus === 'joined')
  }, [provider, roomStatus])

  // Keep awareness user identity (cursor label/color) in sync
  // after room join resolves the final display name.
  useEffect(() => {
    provider.setUser(user)
  }, [provider, user])

  // Request full Y.js state from online peers once joined
  useEffect(() => {
    if (roomStatus !== 'joined') return
    provider.requestSync()
  }, [roomStatus, provider])

  // Seed from REST content only after room is joined and only if
  // the Y.js doc is still empty — peer sync may have already populated it
  useEffect(() => {
    if (roomStatus !== 'joined') return
    if (!editor || !initialContent) return
    if (hasSeededInitialContentRef.current) return

    const timer = setTimeout(() => {
      if (hasSeededInitialContentRef.current) return

      const hasMeaningfulContent = editor.getText().trim().length > 0

      // Only the first member in the room seeds from REST.
      // When peers are already present, wait for CRDT sync from them
      // to avoid duplicate insertion of the same content.
      if (!hasMeaningfulContent && peerCount === 0) {
        editor.commands.setContent(initialContent)
        latestContentRef.current = initialContent
      } else {
        latestContentRef.current = editor.getJSON()
      }

      lastSavedSerializedRef.current = JSON.stringify(initialContent)
      hasSeededInitialContentRef.current = true
      autosaveArmedRef.current = true
    }, 500)

    return () => clearTimeout(timer)
  }, [editor, initialContent, roomStatus, peerCount])

  // Fallback arming path when REST content is null/undefined.
  // We still delay autosave until the room is joined to avoid
  // writing the initial empty Y.Doc during reconnect/join races.
  useEffect(() => {
    if (roomStatus !== 'joined') return
    if (initialContent !== undefined && initialContent !== null) return

    const timer = setTimeout(() => {
      autosaveArmedRef.current = true
    }, 1000)

    return () => clearTimeout(timer)
  }, [roomStatus, initialContent])

  // Apply restored content when contentVersion bumps.
  // contentVersion is a local counter in NotePage, not latestVersionNumber.
  useEffect(() => {
    if (!editor) return
    if (contentVersion === undefined || contentVersion === null) return
    if (contentVersion === 0) return
    if (lastAppliedContentVersionRef.current === contentVersion) return

    suppressAutosaveNextUpdateRef.current = true
    editor.commands.setContent(
      initialContent ?? { type: 'doc', content: [{ type: 'paragraph' }] }
    )

    latestContentRef.current =
      initialContent ?? { type: 'doc', content: [{ type: 'paragraph' }] }
    lastSavedSerializedRef.current = JSON.stringify(latestContentRef.current)
    lastAppliedContentVersionRef.current = contentVersion
    autosaveArmedRef.current = true
  }, [editor, contentVersion, initialContent])

  // Keep editable in sync if role changes mid-session
  useEffect(() => {
    if (!editor) return
    editor.setEditable(canEdit)
  }, [editor, canEdit])

  // Flush on tab hide and clean up on unmount
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistContentKeepalive(latestContentRef.current)
      }
    }

    const onPageHide = () => {
      persistContentKeepalive(latestContentRef.current)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      provider.destroy()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      void flushPendingSave()
    }
  }, [provider, flushPendingSave, persistContentKeepalive])

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