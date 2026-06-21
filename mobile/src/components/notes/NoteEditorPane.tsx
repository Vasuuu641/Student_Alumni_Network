// components/notes/NoteEditorPane.tsx
//
// Owns the TenTap editor bridge end-to-end: creation, autosave, and
// rendering of RichText + the formatting toolbar.
//
// WHY THIS IS A SEPARATE COMPONENT (not inline in NoteScreen):
// useEditorBridge must be called with real initialContent already in hand.
// Every official TenTap example creates the bridge this way — content goes
// in at construction time, not patched in afterward via editor.setContent()
// once some "ready" flag flips. The previous implementation created the
// bridge empty (before the note had loaded) and patched content in later
// via a hand-rolled _subscribeToEditorStateUpdate listener. That listener
// subscribed inside a useEffect keyed on the `editor` object itself — if
// anything caused an extra render before the WebView's one-time "isReady"
// event fired, the subscription could be re-attached a beat too late and
// miss it permanently, leaving the editor stuck empty until a full
// unmount/remount (e.g. leaving and re-entering the note) happened to
// resubscribe in time. Real devices, with slower WebView bridge init than
// some dev environments, hit this far more often.
//
// By only mounting this component once `note` exists (see NoteScreen),
// useEditorBridge is *always* called with the real initialContent already
// resolved — there is no readiness race to lose, because there's nothing
// to patch in after the fact.

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Animated, Text, View } from 'react-native'
import {
  RichText,
  useEditorBridge,
  useEditorContent,
  TenTapStartKit,
} from '@10play/tentap-editor'

import { updateNote } from '../../api/notes.api'
import { MobileEditorToolbar } from './MobileEditorToolbar'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface NoteEditorPaneHandle {
  /** Best-effort flush of any unsaved content. Used on back/background/unmount. */
  flushPendingSave: () => Promise<void>
}

interface Props {
  noteId: string
  token: string
  initialHtml: string
  isContentEmpty: boolean
  canEdit: boolean
  isArchived: boolean
  bottomInset: number
  keyboardHeight: Animated.Value
  isKeyboardVisible: boolean
  onSaveStatusChange: (status: SaveStatus) => void
  /** Live plain-text content, used by NoteScreen for AI-insights eligibility. */
  onContentChange: (html: string) => void
}

// ─── Helpers (mirrors the ones previously in NoteScreen) ──────────────────────

function jsonNodeToHtml(node: any): string {
  if (!node) return ''
  if (node.type === 'doc') return (node.content ?? []).map(jsonNodeToHtml).join('')
  if (node.type === 'paragraph') {
    const inner = (node.content ?? []).map(jsonNodeToHtml).join('')
    return `<p>${inner || '<br>'}</p>`
  }
  if (node.type === 'heading') {
    const level = node.attrs?.level ?? 1
    const inner = (node.content ?? []).map(jsonNodeToHtml).join('')
    return `<h${level}>${inner}</h${level}>`
  }
  if (node.type === 'bulletList') return `<ul>${(node.content ?? []).map(jsonNodeToHtml).join('')}</ul>`
  if (node.type === 'orderedList') return `<ol>${(node.content ?? []).map(jsonNodeToHtml).join('')}</ol>`
  if (node.type === 'listItem') return `<li>${(node.content ?? []).map(jsonNodeToHtml).join('')}</li>`
  if (node.type === 'blockquote') return `<blockquote>${(node.content ?? []).map(jsonNodeToHtml).join('')}</blockquote>`
  if (node.type === 'codeBlock') return `<pre><code>${(node.content ?? []).map(jsonNodeToHtml).join('')}</code></pre>`
  if (node.type === 'horizontalRule') return '<hr>'
  if (node.type === 'text') {
    let text = node.text ?? ''
    const marks: string[] = node.marks?.map((m: any) => m.type) ?? []
    if (marks.includes('bold')) text = `<strong>${text}</strong>`
    if (marks.includes('italic')) text = `<em>${text}</em>`
    if (marks.includes('strike')) text = `<s>${text}</s>`
    if (marks.includes('code')) text = `<code>${text}</code>`
    return text
  }
  return (node.content ?? []).map(jsonNodeToHtml).join('')
}

// ─── Component ────────────────────────────────────────────────────────────────

export const NoteEditorPane = forwardRef<NoteEditorPaneHandle, Props>(function NoteEditorPane(
  {
    noteId,
    token,
    initialHtml,
    isContentEmpty,
    canEdit,
    isArchived,
    bottomInset,
    keyboardHeight,
    isKeyboardVisible,
    onSaveStatusChange,
    onContentChange,
  },
  ref
) {
  const [isEmpty, setIsEmpty] = useState(isContentEmpty)

  const lastSavedRef = useRef<string>(initialHtml)
  const inFlightRef = useRef(false)
  const hasPendingRef = useRef(false)
  const pendingContentRef = useRef<string>('')
  // Armed immediately if canEdit — there's no "wait for ready" step anymore
  // since the bridge is constructed with content already in place.
  const autosaveArmedRef = useRef(canEdit)

  // initialContent supplied directly at construction time — this is the
  // whole point of the refactor. No setContent() call needed after mount.
  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    editable: canEdit && !isArchived,
    initialContent: initialHtml,
    bridgeExtensions: TenTapStartKit,
  })

  const htmlContent = useEditorContent(editor, {
    type: 'html',
    debounceInterval: 500,
  })

  useEffect(() => {
    onContentChange(htmlContent || initialHtml)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlContent])

  const persistContent = useCallback(async (content: string) => {
    if (!canEdit || !token || !noteId) return
    if (!autosaveArmedRef.current) return
    if (content === lastSavedRef.current) return
    if (inFlightRef.current) {
      hasPendingRef.current = true
      pendingContentRef.current = content
      return
    }
    inFlightRef.current = true
    onSaveStatusChange('saving')
    try {
      await updateNote(token, noteId, { content })
      lastSavedRef.current = content
      onSaveStatusChange('saved')
      setTimeout(() => onSaveStatusChange('idle'), 1200)
    } catch {
      onSaveStatusChange('error')
    } finally {
      inFlightRef.current = false
      if (hasPendingRef.current) {
        hasPendingRef.current = false
        const pending = pendingContentRef.current
        pendingContentRef.current = ''
        await persistContent(pending)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, token, noteId, onSaveStatusChange])

  useEffect(() => {
    if (!autosaveArmedRef.current) return
    if (!htmlContent) return
    if (isEmpty && htmlContent.replace(/<[^>]*>/g, '').trim().length > 0) {
      setIsEmpty(false)
    }
    void persistContent(htmlContent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlContent, isEmpty])

  const flushPendingSave = useCallback(async () => {
    if (!autosaveArmedRef.current || !token || !noteId || !canEdit) return
    try {
      const latestHtml = await editor.getHTML()
      await persistContent(latestHtml)
    } catch {
      // best-effort flush
    }
  }, [editor, token, noteId, canEdit, persistContent])

  useImperativeHandle(ref, () => ({ flushPendingSave }), [flushPendingSave])

  // >>> CHANGED ───────────────────────────────────────────────────────────
  // Reverted the fixed-height (TOOLBAR_HEIGHT = 96) approach from the
  // previous pass. Debug screenshots showed Row 2 (bold/italic/underline
  // etc, with real icons) DOES render correctly — but only once the
  // keyboard finishes closing. While the keyboard was open and
  // marginBottom was actively animating to a large value, Row 2 vanished;
  // Row 1 stayed visible the whole time. That's the signature of the fixed
  // height guess being too small for what Row 1 + Row 2 actually need once
  // real fonts/icons are measured on this device — under a shrinking
  // available budget, something (most likely RN's Yoga layout engine
  // reconciling the animated margin against a height it was already
  // constrained by) drops Row 2 first. Once marginBottom relaxes back to 0,
  // the budget is restored and Row 2 reappears.
  //
  // Fix: stop guessing a height. Let Row 1 and Row 2 size themselves from
  // their own content (their original behavior, before any of these
  // changes) and use ONLY marginBottom to push the whole toolbar above the
  // keyboard. There is no longer a hard ceiling that Row 2 can be squeezed
  // against.
  // <<< CHANGED

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <RichText editor={editor} style={{ flex: 1 }} />
        {isEmpty && canEdit && !isArchived && (
          <View
            className="absolute left-0 right-0 top-0"
            style={{ paddingTop: 16, paddingHorizontal: 24 }}
            pointerEvents="none"
          >
            <Text className="text-[15px] text-[#c8d5e8]">
              Start writing your note…
            </Text>
          </View>
        )}
      </View>

      {canEdit && (
        <Animated.View
          style={{
            marginBottom: keyboardHeight,
          }}
        >
          <MobileEditorToolbar
            editor={editor}
            bottomInset={isKeyboardVisible ? 0 : bottomInset}
          />
        </Animated.View>
      )}
    </View>
  )
  // <<< CHANGED
})