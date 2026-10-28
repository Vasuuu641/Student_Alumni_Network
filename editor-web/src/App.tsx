// editor-web/src/App.tsx
import { EditorContent } from '@tiptap/react'
import {
  useTenTap,
  TenTapStartKit,
  ImageBridge,
  HistoryBridge,
} from '@10play/tentap-editor/web'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import TextAlign from '@tiptap/extension-text-align'
import FontFamily from '@tiptap/extension-font-family'
import { PageSection } from './extensions/PageSection'
import { FontSize } from './extensions/FontSize'
import { ydoc, awareness } from './collab'
import { CollabWebBridge } from './CollabWebBridge'
import './collab.css'

// Same list, same order as the native side. HistoryBridge is removed because Yjs owns undo.
const bridges = [
  ...TenTapStartKit.filter((b: any) => b !== HistoryBridge),
  ImageBridge,
  CollabWebBridge,
]

export default function App() {
  const editor = useTenTap({
    bridges,
    tiptapOptions: {
      editable: false,
      extensions: [
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({
          provider: { awareness } as any,
          user: { name: 'Connecting…', color: '#999999' },
        }),
        PageSection,
        FontSize,
        FontFamily,
        TextAlign.configure({ types: ['paragraph', 'heading'] }),
      ],
    },
  })

  return <EditorContent editor={editor} />
}