// components/notes/NoteEditorPane.tsx
//
// Owns the TenTap editor bridge end-to-end: creation, autosave, and
// rendering of RichText + the formatting toolbar.
//
// WHY THIS IS A SEPARATE COMPONENT (not inline in NoteScreen):
// useEditorBridge must be called with real initialContent already in hand.
// This component only mounts once `note` is loaded (see NoteScreen), so
// useEditorBridge is always called with the real content — no readiness
// race, no setContent() patch-up after the fact.
//
// Keyboard tracking: uses the JS-only useAnimatedKeyboardHeight hook
// (RN Keyboard listeners + Animated.timing). No Reanimated or
// react-native-keyboard-controller required.

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
import { useAnimatedKeyboardHeight } from '../../hooks/useAnimatedKeyboardHeight'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface NoteEditorPaneHandle {
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
  onContentChange: (html: string) => void
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

  // Keyboard height tracking — JS-only, no Reanimated required.
  // heightAnim drives marginBottom on the toolbar's Animated.View.
  // isVisible zeroes out bottomInset once the keyboard is up (the keyboard
  // itself already covers the home-indicator safe area).
  const { heightAnim: keyboardHeight, isVisible: isKeyboardVisible } =
    useAnimatedKeyboardHeight()

  const lastSavedRef = useRef<string>(initialHtml)
  const inFlightRef = useRef(false)
  const hasPendingRef = useRef(false)
  const pendingContentRef = useRef<string>('')
  const autosaveArmedRef = useRef(canEdit)

  // initialContent passed directly at construction time — no setContent()
  // patch needed after mount, no readiness subscription needed.
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

  return (
    <View style={{ flex: 1 }}>
      {/* Editor region — flex:1 absorbs all available space */}
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

      {/* Toolbar — marginBottom tracks keyboard height so it stays
          flush above the keyboard on both iOS and Android. bottomInset
          is only applied when the keyboard is closed since the keyboard
          itself covers the home-indicator safe area. */}
      {canEdit && (
        <Animated.View style={{ marginBottom: keyboardHeight }}>
          <MobileEditorToolbar
            editor={editor}
            bottomInset={isKeyboardVisible ? 0 : bottomInset}
          />
        </Animated.View>
      )}
    </View>
  )
})