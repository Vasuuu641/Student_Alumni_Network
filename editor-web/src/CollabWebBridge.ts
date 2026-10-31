import { BridgeExtension } from '@10play/tentap-editor/web'
import { Extension } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Heading from '@tiptap/extension-heading'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import Blockquote from '@tiptap/extension-blockquote'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Image from '@tiptap/extension-image'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import TextAlign from '@tiptap/extension-text-align'
import FontFamily from '@tiptap/extension-font-family'
import { PageSection } from './extensions/PageSection'
import { FontSize } from './extensions/FontSize'
import { ydoc, awareness, createCollab } from './collab'


const CollabEditorExtensions = Extension.create({
  name: 'collab',
  addExtensions() {
    return [
      Document,
      Paragraph,
      Text,
      Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
      BulletList,
      OrderedList,
      ListItem,
      Blockquote,
      HorizontalRule,
      Image,
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({
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
let currentNoteId = ''

export const CollabWebBridge = new BridgeExtension<any, any, any>({
  forceName: 'collab',
  tiptapExtension: CollabEditorExtensions,
  onBridgeMessage: (editor: any, message: any, sendMessageBack: any) => {
    const post = (type: string, data?: unknown) =>
      sendMessageBack({ type: `collab-${type}`, payload: { noteId: currentNoteId, data } })
    switch (message.type) {
      case 'collab-init':
        currentNoteId = message.payload.noteId
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
        editor.commands.undo?.()
        return true
      case 'collab-redo':
        editor.commands.redo?.()
        return true
    }
    return false
  },
})