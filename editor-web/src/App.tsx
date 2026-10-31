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
// If the phone's injected script hasn't run yet, TenTap finds no bridge config
// and builds an editor with no nodes ("Schema is missing its top node type").
if (typeof window !== 'undefined' && !(window as any).bridgeExtensionConfigMap) {
  (window as any).bridgeExtensionConfigMap = JSON.stringify(
    Object.fromEntries(
      bridges.map((b: any) => [b.name, { optionsConfig: b.config, extendConfig: b.extendConfig }]),
    ),
  )
}

export default function App() {
  const editor = useTenTap({
    bridges,
    tiptapOptions: { editable: false },
  })
  return <EditorContent editor={editor} />
}