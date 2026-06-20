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
  // Previously this returned a fragment, making the editor View and the
  // toolbar's Animated.View two *separate* flex children of NoteScreen's
  // root container. On Android, once the keyboard genuinely resizes the
  // window (which only happens correctly in a Dev Client build, not Expo
  // Go — see the project README notes), both flex:1 / flex-sibling regions
  // have to renegotiate their share of the now-smaller height in the same
  // layout pass as RichText's WebView. ScrollViews need a real non-zero
  // bounded height to render anything at all (this is documented RN
  // behavior, not a bug specific to this component) — if the WebView's
  // layout pass claims space before the toolbar's measurement settles, the
  // toolbar's available height can transiently resolve to ~0. Row 1 (a
  // plain View, no ScrollView) can still paint in a sliver of squeezed
  // space; Row 2's ScrollView cannot.
  //
  // Fix: wrap everything in one View style={{ flex: 1 }}, and make the
  // toolbar a *fixed-height, non-flex* block (TOOLBAR_HEIGHT) rather than a
  // flex-sibling. Only the RichText container is flex:1 now. When Android
  // shrinks the available height, the math becomes "fixed toolbar height
  // stays fixed, RichText's region absorbs 100% of the shrink" — there is
  // no longer a layout pass where the toolbar's height is ambiguous or can
  // be squeezed toward zero, regardless of WebView resize timing.
  const TOOLBAR_HEIGHT = 96 // Row 1 (≈44) + Row 2 (44) + small borders/padding
  // bottomInset only adds real height when the keyboard is closed — once
  // it's open, MobileEditorToolbar zeroes its own paddingBottom (see
  // isKeyboardVisible below), so don't double-count it here.
  const toolbarContainerHeight = TOOLBAR_HEIGHT + (isKeyboardVisible ? 0 : bottomInset)
  // NOTE: MobileEditorToolbar's font-size picker overlay adds extra height
  // above Row 1 when toggled open. That overlay is not accounted for in
  // TOOLBAR_HEIGHT — it will be clipped by this fixed-height container if
  // opened. If you hit that, either bump toolbarContainerHeight while the
  // picker is open (would need a small piece of state lifted up from
  // MobileEditorToolbar), or render the picker as an absolutely-positioned
  // overlay instead of in-flow. Not fixed here since it's outside the scope
  // of the keyboard-hiding bug this change addresses.

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
        // DEBUG: green border = the fixed-height wrapper itself. Remove after diagnosing.
        <Animated.View
          style={{
            height: toolbarContainerHeight,
            marginBottom: keyboardHeight,
            borderWidth: 3,
            borderColor: 'lime',
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