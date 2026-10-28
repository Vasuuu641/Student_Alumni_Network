import { BridgeExtension } from '@10play/tentap-editor/web'
import { Extension } from '@tiptap/core'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import TextAlign from '@tiptap/extension-text-align'
import FontFamily from '@tiptap/extension-font-family'
import { PageSection } from './extensions/PageSection'
import { FontSize } from './extensions/FontSize'
import { ydoc, awareness, createCollab } from './collab'

const CollabEditorExtensions = Extension.create({
  name: 'collabEditorExtensions',
  addExtensions() {
    return [
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider: { awareness } as any,
        user: { name: 'Connecting…', color: '#999999' },
      }),
      PageSection,
      FontSize,
      FontFamily,
      TextAlign.configure({ types: ['paragraph', 'heading'] }),
    ]
  },
})

let collab: ReturnType<typeof createCollab> | null = null

export const CollabWebBridge = new BridgeExtension<any, any, any>({
  forceName: 'collab',
  tiptapExtension: CollabEditorExtensions,
  onBridgeMessage: (editor: any, message: any, sendMessageBack: any) => {
    const post = (type: string, payload?: unknown) =>
      sendMessageBack({ type: `collab-${type}`, payload })
    switch (message.type) {
      case 'collab-init':
        collab ??= createCollab(editor, post)
        collab.init(message.payload)
        return true
      case 'collab-room':
        collab?.setRoom(message.payload)
        return true
      case 'collab-socket':
        collab?.socketEvent(message.payload.ev, message.payload.payload)
        return true
      case 'collab-replace':
        collab?.replace(message.payload)
        return true
      case 'collab-flush':
        collab?.flush()
        return true
      case 'collab-undo':
        editor.commands.undo()
        return true
      case 'collab-redo':
        editor.commands.redo()
        return true
    }
    return false
  },
})