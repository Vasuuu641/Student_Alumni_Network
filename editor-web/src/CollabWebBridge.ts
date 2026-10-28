import { BridgeExtension } from '@10play/tentap-editor/web'
import { createCollab } from './collab'

let collab: ReturnType<typeof createCollab> | null = null

export const CollabWebBridge = new BridgeExtension<any, any, any>({
  forceName: 'collab',
  onBridgeMessage: (editor: any, message: any, sendMessageBack: any) => {
    const post = (type: string, payload?: unknown) =>
      sendMessageBack({ type: `collab-${type}`, payload })
    switch (message.type) {
      case 'collab-init':   collab ??= createCollab(editor, post); collab.init(message.payload); return true
      case 'collab-room':   collab?.setRoom(message.payload); return true
      case 'collab-socket': collab?.socketEvent(message.payload.ev, message.payload.payload); return true
      case 'collab-replace':collab?.replace(message.payload); return true
      case 'collab-flush':  collab?.flush(); return true
      case 'collab-undo':   editor.commands.undo(); return true   // from Collaboration extension
      case 'collab-redo':   editor.commands.redo(); return true
    }
    return false
  },
})