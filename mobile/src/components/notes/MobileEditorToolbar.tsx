// components/notes/MobileEditorToolbar.tsx
// Custom two-row rich-text toolbar for TenTap on mobile.
//
// Row 1 (tools)  — keyboard dismiss, undo, redo, horizontal rule
// Row 2 (format) — scrollable: paragraph/H1/H2/H3, font size, bold, italic,
//                  underline, strikethrough, highlight, inline code,
//                  bullet list, ordered list, blockquote, align L/C/R
//
// Usage (in NoteEditor):
//   const editorState = useEditorState(editor)
//   <MobileEditorToolbar editor={editor} editorState={editorState} bottomInset={insets.bottom} />

import { useCallback, useState } from 'react'
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import type { EditorBridge } from '@10play/tentap-editor'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  ChevronDown,
  ChevronUp,
  KeyboardOff,
} from 'lucide-react-native'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditorState {
  isBoldActive?: boolean
  isItalicActive?: boolean
  isUnderlineActive?: boolean
  isStrikeActive?: boolean
  isHighlightActive?: boolean
  isCodeActive?: boolean
  isBulletListActive?: boolean
  isOrderedListActive?: boolean
  isBlockquoteActive?: boolean
  activeHeadingLevel?: number | false
  activeTextAlign?: string
  canUndo?: boolean
  canRedo?: boolean
  [key: string]: any
}

interface Props {
  editor: EditorBridge
  editorState?: EditorState
  bottomInset?: number
}

// ─── Colour tokens ────────────────────────────────────────────────────────────

const ACTIVE_FG   = '#2f64f6'
const ACTIVE_BG   = '#eaf1ff'
const ACTIVE_BD   = '#2f64f6'
const DEFAULT_FG  = '#344766'
const MUTED_FG    = '#94a3b8'
const TOOLBAR_BG  = '#f8faff'
const TOOLS_BG    = '#f0f4fa'
const BORDER_COL  = '#e4ecf7'
const HIGHLIGHT   = '#f59e0b'

// ─── Font sizes ───────────────────────────────────────────────────────────────

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48]

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileEditorToolbar({ editor, editorState, bottomInset = 0 }: Props) {
  const [showFontPicker, setShowFontPicker] = useState(false)
  const [fontSize, setFontSize] = useState(16)

  const run = useCallback((fn: () => void) => { fn() }, [])

  function applyFontSize(size: number) {
    setFontSize(size)
    setShowFontPicker(false)
    // Font size requires the fontSize bridge extension which isn't in TenTapStartKit
    // Local state tracks the selected size for UI only
  }

  // ── Active state helpers ─────────────────────────────────────────────────
  const isBold        = !!editorState?.isBoldActive
  const isItalic      = !!editorState?.isItalicActive
  const isUnderline   = !!editorState?.isUnderlineActive
  const isStrike      = !!editorState?.isStrikeActive
  const isHighlight   = !!editorState?.isHighlightActive
  const isCode        = !!editorState?.isCodeActive
  const isBullet      = !!editorState?.isBulletListActive
  const isOrdered     = !!editorState?.isOrderedListActive
  const isBlockquote  = !!editorState?.isBlockquoteActive
  const headingLevel  = editorState?.activeHeadingLevel
  const textAlign     = editorState?.activeTextAlign ?? 'left'
  const canUndo       = editorState?.canUndo ?? true
  const canRedo       = editorState?.canRedo ?? true

  return (
    <View style={{ backgroundColor: TOOLBAR_BG, paddingBottom: bottomInset }}>

      {/* ── Font size picker overlay ─────────────────────────────────────── */}
      {showFontPicker && (
        <View
          style={{ backgroundColor: TOOLBAR_BG, borderTopWidth: 1, borderTopColor: BORDER_COL }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8, gap: 6, alignItems: 'center' }}
          >
            {FONT_SIZES.map((s) => {
              const active = fontSize === s
              return (
                <Pressable
                  key={s}
                  onPress={() => applyFontSize(s)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: active ? ACTIVE_BD : BORDER_COL,
                    backgroundColor: active ? ACTIVE_BG : '#fff',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: active ? ACTIVE_FG : DEFAULT_FG }}>
                    {s}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Row 1: Tool actions ──────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 6,
          borderTopWidth: 1,
          borderTopColor: BORDER_COL,
          backgroundColor: TOOLS_BG,
        }}
      >
        {/* Dismiss keyboard */}
        <ToolBtn
          onPress={() => Keyboard.dismiss()}
          icon={<KeyboardOff size={19} color={DEFAULT_FG} />}
        />

        <View style={{ flex: 1 }} />

        {/* Undo */}
        <ToolBtn
          onPress={() => run(() => editor.undo())}
          icon={<Undo2 size={19} color={canUndo ? DEFAULT_FG : MUTED_FG} />}
          disabled={!canUndo}
        />

        {/* Redo */}
        <ToolBtn
          onPress={() => run(() => editor.redo())}
          icon={<Redo2 size={19} color={canRedo ? DEFAULT_FG : MUTED_FG} />}
          disabled={!canRedo}
        />

        {/* Horizontal rule */}
        <ToolBtn
          onPress={() => run(() => { try { (editor as any).setHorizontalRule() } catch { /* not supported */ } })}
          icon={<Minus size={19} color={DEFAULT_FG} />}
        />
      </View>

      {/* ── Row 2: Formatting (horizontally scrollable) ──────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{
          paddingHorizontal: 6,
          paddingVertical: 5,
          alignItems: 'center',
          gap: 2,
        }}
      >
        {/* ── Block type ──────────────────────────────────────────────────── */}
        <FmtBtn
          onPress={() => run(() => { try { (editor as any).setParagraph() } catch { /* not supported */ } })}
          active={!headingLevel}
          icon={<Pilcrow size={16} color={!headingLevel ? ACTIVE_FG : DEFAULT_FG} />}
        />
        <FmtBtn
          onPress={() => run(() => editor.toggleHeading(1))}
          active={headingLevel === 1}
          label="H1"
          icon={<Heading1 size={16} color={headingLevel === 1 ? ACTIVE_FG : DEFAULT_FG} />}
        />
        <FmtBtn
          onPress={() => run(() => editor.toggleHeading(2))}
          active={headingLevel === 2}
          icon={<Heading2 size={16} color={headingLevel === 2 ? ACTIVE_FG : DEFAULT_FG} />}
        />
        <FmtBtn
          onPress={() => run(() => editor.toggleHeading(3))}
          active={headingLevel === 3}
          icon={<Heading3 size={16} color={headingLevel === 3 ? ACTIVE_FG : DEFAULT_FG} />}
        />

        <Sep />

        {/* ── Font size toggle ─────────────────────────────────────────────── */}
        <Pressable
          onPress={() => setShowFontPicker((v) => !v)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: showFontPicker ? ACTIVE_BD : 'transparent',
            backgroundColor: showFontPicker ? ACTIVE_BG : 'transparent',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: showFontPicker ? ACTIVE_FG : DEFAULT_FG }}>
            Aa
          </Text>
          <Text style={{ fontSize: 10, fontWeight: '600', color: showFontPicker ? ACTIVE_FG : MUTED_FG }}>
            {fontSize}
          </Text>
          {showFontPicker
            ? <ChevronDown size={11} color={ACTIVE_FG} />
            : <ChevronUp size={11} color={MUTED_FG} />
          }
        </Pressable>

        <Sep />

        {/* ── Inline marks ─────────────────────────────────────────────────── */}
        <FmtBtn
          onPress={() => run(() => editor.toggleBold())}
          active={isBold}
          icon={<Bold size={16} color={isBold ? ACTIVE_FG : DEFAULT_FG} />}
        />
        <FmtBtn
          onPress={() => run(() => editor.toggleItalic())}
          active={isItalic}
          icon={<Italic size={16} color={isItalic ? ACTIVE_FG : DEFAULT_FG} />}
        />
        <FmtBtn
          onPress={() => run(() => editor.toggleUnderline())}
          active={isUnderline}
          icon={<Underline size={16} color={isUnderline ? ACTIVE_FG : DEFAULT_FG} />}
        />
        <FmtBtn
          onPress={() => run(() => editor.toggleStrike())}
          active={isStrike}
          icon={<Strikethrough size={16} color={isStrike ? ACTIVE_FG : DEFAULT_FG} />}
        />
        <FmtBtn
          onPress={() => run(() => editor.toggleHighlight('#fef08a'))}
          active={isHighlight}
          icon={<Highlighter size={16} color={isHighlight ? HIGHLIGHT : DEFAULT_FG} />}
        />
        <FmtBtn
          onPress={() => run(() => editor.toggleCode())}
          active={isCode}
          icon={<Code size={16} color={isCode ? ACTIVE_FG : DEFAULT_FG} />}
        />

        <Sep />

        {/* ── Lists & blocks ───────────────────────────────────────────────── */}
        <FmtBtn
          onPress={() => run(() => editor.toggleBulletList())}
          active={isBullet}
          icon={<List size={16} color={isBullet ? ACTIVE_FG : DEFAULT_FG} />}
        />
        <FmtBtn
          onPress={() => run(() => editor.toggleOrderedList())}
          active={isOrdered}
          icon={<ListOrdered size={16} color={isOrdered ? ACTIVE_FG : DEFAULT_FG} />}
        />
        <FmtBtn
          onPress={() => run(() => editor.toggleBlockquote())}
          active={isBlockquote}
          icon={<Quote size={16} color={isBlockquote ? ACTIVE_FG : DEFAULT_FG} />}
        />

        <Sep />

        {/* ── Alignment ────────────────────────────────────────────────────── */}
        <FmtBtn
          onPress={() => run(() => { try { (editor as any).setTextAlign('left') } catch { /* not supported */ } })}
          active={textAlign === 'left'}
          icon={<AlignLeft size={16} color={textAlign === 'left' ? ACTIVE_FG : DEFAULT_FG} />}
        />
        <FmtBtn
          onPress={() => run(() => { try { (editor as any).setTextAlign('center') } catch { /* not supported */ } })}
          active={textAlign === 'center'}
          icon={<AlignCenter size={16} color={textAlign === 'center' ? ACTIVE_FG : DEFAULT_FG} />}
        />
        <FmtBtn
          onPress={() => run(() => { try { (editor as any).setTextAlign('right') } catch { /* not supported */ } })}
          active={textAlign === 'right'}
          icon={<AlignRight size={16} color={textAlign === 'right' ? ACTIVE_FG : DEFAULT_FG} />}
        />
      </ScrollView>
    </View>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FmtBtnProps {
  icon: React.ReactNode
  onPress: () => void
  active?: boolean
  label?: string
}

function FmtBtn({ icon, onPress, active, label }: FmtBtnProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? ACTIVE_BD : 'transparent',
        backgroundColor: active ? ACTIVE_BG : 'transparent',
        minWidth: 36,
        gap: 3,
      }}
    >
      {icon}
      {label && (
        <Text style={{ fontSize: 11, fontWeight: '700', color: active ? ACTIVE_FG : DEFAULT_FG }}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}

interface ToolBtnProps {
  icon: React.ReactNode
  onPress: () => void
  disabled?: boolean
}

function ToolBtn({ icon, onPress, disabled }: ToolBtnProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        padding: 7,
        borderRadius: 8,
        marginHorizontal: 2,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {icon}
    </Pressable>
  )
}

function Sep() {
  return (
    <View
      style={{
        width: 1,
        height: 20,
        backgroundColor: BORDER_COL,
        marginHorizontal: 4,
        borderRadius: 1,
      }}
    />
  )
}