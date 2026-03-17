// src/components/notes/EditorToolbar.tsx
import { useMemo, useRef, useState, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import {
  Bold, Italic, Strikethrough, Code, Code2,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  Undo2, Redo2, Minus, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link, ZoomIn, ZoomOut,
} from 'lucide-react'

interface Props {
  editor: Editor | null
}

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: 'monospace' },
  { label: 'Sans', value: 'Arial, sans-serif' },
]

const FONT_SIZES = [
  '12px', '14px', '16px', '18px', '20px',
  '24px', '28px', '32px', '36px', '48px',
]

const HIGHLIGHT_COLORS = [
  '#FFFF00', '#FFA500', '#FF6B6B',
  '#90EE90', '#ADD8E6', '#DDA0DD',
]

export function EditorToolbar({ editor }: Props) {
  const [openMenu, setOpenMenu] = useState<'file' | 'edit' | 'view' | 'insert' | null>(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [zoom, setZoom] = useState(100)
  const linkInputRef = useRef<HTMLInputElement>(null)

  if (!editor) return null

  // ─── Zoom ─────────────────────────────────────────────────────────────────

  function applyZoom(newZoom: number) {
    const clamped = Math.min(200, Math.max(50, newZoom))
    setZoom(clamped)
    const paperEl = document.querySelector('.note-paper') as HTMLElement | null
    if (paperEl) {
      paperEl.style.transform = `scale(${clamped / 100})`
      paperEl.style.transformOrigin = 'top center'
    }
  }

  // ─── Link ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (showLinkInput) {
      setTimeout(() => linkInputRef.current?.focus(), 50)
      setLinkUrl(editor.getAttributes('link').href ?? '')
    }
  }, [showLinkInput])

  function applyLink() {
    if (!linkUrl.trim()) {
      if (editor) {
        editor.chain().focus().unsetLink().run()
      }
    } else {
      if (editor) {
        editor.chain().focus().setLink({ href: linkUrl.trim() }).run()
      }
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }

  function handleLinkKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') applyLink()
    if (e.key === 'Escape') {
      setShowLinkInput(false)
      setLinkUrl('')
    }
  }

  // ─── Word count ───────────────────────────────────────────────────────────

  const wordCount = useMemo(() => {
    const text = editor.getText().trim()
    return text ? text.split(/\s+/).length : 0
  }, [editor.state])

  // ─── Page helpers ─────────────────────────────────────────────────────────

  const buildBlankPageSpacer = () => [
    { type: 'horizontalRule' as const },
    ...Array.from({ length: 20 }, () => ({ type: 'paragraph' as const })),
  ]

  const insertPageBreak = () => {
    const endPos = editor.state.doc.content.size
    editor.chain().focus('end').insertContentAt(endPos, buildBlankPageSpacer()).focus('end').run()
  }

  const downloadTxt = () => {
    const blob = new Blob([editor.getText()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'note.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const scrollArea = document.querySelector('.note-scroll-area') as HTMLElement | null

  return (
    <div className="note-toolbar__stack">

      {/* ─── Menu bar ───────────────────────────────────────────────── */}
      <div className="note-menubar">
        <Menu
          label="File"
          open={openMenu === 'file'}
          onToggle={() => setOpenMenu((m) => (m === 'file' ? null : 'file'))}
          onClose={() => setOpenMenu(null)}
          items={[
            { label: 'New page', action: insertPageBreak },
            { label: 'Download .txt', action: downloadTxt },
          ]}
        />
        <Menu
          label="Edit"
          open={openMenu === 'edit'}
          onToggle={() => setOpenMenu((m) => (m === 'edit' ? null : 'edit'))}
          onClose={() => setOpenMenu(null)}
          items={[
            { label: 'Undo', action: () => editor.chain().focus().undo().run(), disabled: !editor.can().undo() },
            { label: 'Redo', action: () => editor.chain().focus().redo().run(), disabled: !editor.can().redo() },
            { label: 'Select all', action: () => editor.chain().focus().selectAll().run() },
          ]}
        />
        <Menu
          label="View"
          open={openMenu === 'view'}
          onToggle={() => setOpenMenu((m) => (m === 'view' ? null : 'view'))}
          onClose={() => setOpenMenu(null)}
          items={[
            { label: `Word count: ${wordCount}`, action: () => {}, disabled: true },
            { label: 'Scroll to top', action: () => scrollArea?.scrollTo({ top: 0, behavior: 'smooth' }) },
            { label: 'Scroll to bottom', action: () => scrollArea?.scrollTo({ top: scrollArea.scrollHeight, behavior: 'smooth' }) },
          ]}
        />
        <Menu
          label="Insert"
          open={openMenu === 'insert'}
          onToggle={() => setOpenMenu((m) => (m === 'insert' ? null : 'insert'))}
          onClose={() => setOpenMenu(null)}
          items={[
            { label: 'New page', action: insertPageBreak },
            { label: 'Horizontal line', action: () => editor.chain().focus().setHorizontalRule().run() },
            { label: 'Blockquote', action: () => editor.chain().focus().toggleBlockquote().run() },
            { label: 'Code block', action: () => editor.chain().focus().toggleCodeBlock().run() },
            { label: 'Link', action: () => setShowLinkInput(true) },
          ]}
        />
      </div>

      {/* ─── Main toolbar ───────────────────────────────────────────── */}
      <div className="note-toolbar__inner">

        {/* History */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (⌘Z)">
          <Undo2 size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (⌘⇧Z)">
          <Redo2 size={15} />
        </ToolbarButton>

        <Divider />

        {/* Font family */}
        <select
          className="note-toolbar__select"
          title="Font family"
          value={editor.getAttributes('textStyle').fontFamily ?? ''}
          onChange={(e) => {
            if (e.target.value === '') {
              editor.chain().focus().unsetFontFamily().run()
            } else {
              editor.chain().focus().setFontFamily(e.target.value).run()
            }
          }}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Font size */}
        <select
          className="note-toolbar__select note-toolbar__select--sm"
          title="Font size"
          value={editor.getAttributes('textStyle').fontSize ?? ''}
          onChange={(e) => {
            if (e.target.value === '') {
            editor.chain().focus().unsetMark('textStyle').run()
            } else {
            editor
              .chain()
              .focus()
              // @ts-ignore — fontSize is our custom attribute on textStyle
              .setMark('textStyle', { fontSize: e.target.value })
              .run()
            }
          }}
        >
          <option value="">Size</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <Divider />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 size={15} />
        </ToolbarButton>

        <Divider />

        {/* Text style */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (⌘B)">
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (⌘I)">
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
          <Code size={15} />
        </ToolbarButton>

        <Divider />

        {/* Text alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
          <AlignLeft size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
          <AlignCenter size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
          <AlignRight size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
          <AlignJustify size={15} />
        </ToolbarButton>

        <Divider />

        {/* Highlight colors */}
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            title={`Highlight ${color}`}
            onClick={() => {
              if (editor.isActive('highlight', { color })) {
                editor.chain().focus().unsetHighlight().run()
              } else {
                editor.chain().focus().setHighlight({ color }).run()
              }
            }}
            className={`note-toolbar__color-btn${editor.isActive('highlight', { color }) ? ' note-toolbar__color-btn--active' : ''}`}
            style={{ backgroundColor: color }}
          />
        ))}

        <Divider />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered size={15} />
        </ToolbarButton>

        <Divider />

        {/* Blocks */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <Quote size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
          <Code2 size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus size={15} />
        </ToolbarButton>

        <Divider />

        {/* Link */}
        <ToolbarButton
          onClick={() => setShowLinkInput((v) => !v)}
          active={editor.isActive('link') || showLinkInput}
          title="Insert link"
        >
          <Link size={15} />
        </ToolbarButton>

        <Divider />

        {/* Zoom */}
        <ToolbarButton onClick={() => applyZoom(zoom - 10)} title="Zoom out">
          <ZoomOut size={15} />
        </ToolbarButton>
        <span className="note-toolbar__zoom-label">{zoom}%</span>
        <ToolbarButton onClick={() => applyZoom(zoom + 10)} title="Zoom in">
          <ZoomIn size={15} />
        </ToolbarButton>

      </div>

      {/* ─── Link input row ──────────────────────────────────────────── */}
      {showLinkInput && (
        <div className="note-toolbar__link-row">
          <input
            ref={linkInputRef}
            className="note-toolbar__link-input"
            type="url"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={handleLinkKeyDown}
          />
          <button className="note-toolbar__link-apply" onClick={applyLink}>
            Apply
          </button>
          <button
            className="note-toolbar__link-cancel"
            onClick={() => { setShowLinkInput(false); setLinkUrl('') }}
          >
            Cancel
          </button>
          {editor.isActive('link') && (
            <button
              className="note-toolbar__link-remove"
              onClick={() => {
                editor.chain().focus().unsetLink().run()
                setShowLinkInput(false)
              }}
            >
              Remove link
            </button>
          )}
        </div>
      )}

    </div>
  )
}

// ─── Menu component ───────────────────────────────────────────────────────

interface MenuItem {
  label: string
  action: () => void
  disabled?: boolean
}

function Menu({ label, open, onToggle, onClose, items }: {
  label: string
  open: boolean
  onToggle: () => void
  onClose: () => void
  items: MenuItem[]
}) {
  return (
    <div className="note-menu" onMouseLeave={onClose}>
      <button className="note-menu__trigger" onClick={onToggle}>
        {label}
      </button>
      {open && (
        <div className="note-menu__dropdown">
          {items.map((item) => (
            <button
              key={item.label}
              className="note-menu__item"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                item.action()
                onClose()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Toolbar primitives ───────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, active = false, disabled = false, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`note-toolbar__btn${active ? ' note-toolbar__btn--active' : ''}${disabled ? ' note-toolbar__btn--disabled' : ''}`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="note-toolbar__divider" />
}