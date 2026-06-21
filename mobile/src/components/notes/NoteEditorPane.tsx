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
import { Text, View } from 'react-native'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
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
    onSaveStatusChange,
    onContentChange,
  },
  ref
) {
  const [isEmpty, setIsEmpty] = useState(isContentEmpty)

  // >>> CHANGED ───────────────────────────────────────────────────────────
  // Keyboard tracking via react-native-keyboard-controller's
  // useKeyboardHandler — reads keyboard frame changes from native code via
  // a Reanimated worklet, updating a SharedValue on the UI thread directly.
  // Requires <KeyboardProvider> wrapping the navigation root (App.tsx),
  // react-native-reanimated 4.1.x, and react-native-worklets (both
  // installed alongside it).
  //
  // Single handler registration (not two) so the animated height and the
  // isKeyboardVisible flag can never drift out of sync with each other —
  // both are derived from the exact same event stream.
  const keyboardHeightSV = useSharedValue(0)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

  // DEBUG: plain-JS mirror of keyboardHeightSV so we can render the actual
  // numeric value on screen. Remove once the toolbar positioning is fixed.
  const [debugKeyboardHeight, setDebugKeyboardHeight] = useState(0)

  useKeyboardHandler(
    {
      onStart: (e) => {
        'worklet'
        if (e.height > 0) {
          runOnJS(setIsKeyboardVisible)(true)
        }
      },
      onMove: (e) => {
        'worklet'
        keyboardHeightSV.value = Math.max(e.height, 0)
        runOnJS(setDebugKeyboardHeight)(Math.round(e.height))
      },
      onEnd: (e) => {
        'worklet'
        keyboardHeightSV.value = Math.max(e.height, 0)
        runOnJS(setDebugKeyboardHeight)(Math.round(e.height))
        if (e.height === 0) {
          runOnJS(setIsKeyboardVisible)(false)
        }
      },
    },
    []
  )

  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    marginBottom: keyboardHeightSV.value,
  }))
  // <<< CHANGED

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
  // Switched keyboard tracking from RN's JS-only Keyboard API
  // (useAnimatedKeyboardHeight, since removed) to
  // react-native-keyboard-controller's useKeyboardHandler, set up above.
  // The earlier fixed-height experiments (TOOLBAR_HEIGHT) were a red
  // herring — debug screenshots confirmed Row 2 renders correctly with
  // real content, but only once the keyboard finished closing. That is the
  // signature of a confirmed react-native-screens bug (#2124): native-stack
  // screen children can get an incorrect layout pass specifically while
  // Fabric/New-Arch is reconciling a JS-driven Animated.Value-based resize
  // on Android. Reanimated's worklet-driven SharedValue updates the UI
  // thread directly, bypassing that unreliable JS-triggered re-layout path
  // entirely — which is the actual fix, not another height guess.
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
        {/* DEBUG: shows live keyboardHeightSV value. Positioned absolute +
            top so it stays visible regardless of what's happening to the
            toolbar's own marginBottom below. Remove once fixed. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'black',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            zIndex: 999,
          }}
        >
          <Text style={{ color: 'lime', fontSize: 12, fontFamily: 'monospace' }}>
            kb: {debugKeyboardHeight} | vis: {isKeyboardVisible ? 'Y' : 'N'}
          </Text>
        </View>
      </View>

      {canEdit && (
        <Animated.View style={[toolbarAnimatedStyle, { borderWidth: 2, borderColor: 'red' }]}>
          <MobileEditorToolbar
            editor={editor}
            bottomInset={isKeyboardVisible ? 0 : bottomInset}
          />
        </Animated.View>
      )}
    </View>
  )
})