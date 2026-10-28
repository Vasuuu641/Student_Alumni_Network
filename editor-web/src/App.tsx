import { EditorContent } from '@tiptap/react'
import {
  useTenTap,
  TenTapStartKit,
  ImageBridge,
  HistoryBridge,
} from '@10play/tentap-editor/web'
import { CollabWebBridge } from './CollabWebBridge'
import './collab.css'

// Keep this list identical to the one in NoteScreen.tsx.
const base = (TenTapStartKit as any[]).filter((b) => b !== HistoryBridge)
const bridges = [
  ...base,
  ...(base.includes(ImageBridge) ? [] : [ImageBridge]),
  CollabWebBridge,
]

export default function App() {
  const editor = useTenTap({
    bridges,
    tiptapOptions: { editable: false },
  })
  return <EditorContent editor={editor} />
}