import { BridgeExtension } from '@10play/tentap-editor'

export type CollabListener = (type: string, payload: any) => void
export const collabListeners = new Set<CollabListener>()

export const CollabNativeBridge = new BridgeExtension<any, any, any>({
  forceName: 'collab',
  extendEditorInstance: (send: any) => ({
    collabInit: (p: any) => send({ type: 'collab-init', payload: p }),
    collabRoom: (p: any) => send({ type: 'collab-room', payload: p }),
    collabSocket: (ev: string, payload: any) =>
      send({ type: 'collab-socket', payload: { ev, payload } }),
    collabReplace: (json: any) => send({ type: 'collab-replace', payload: json }),
    collabFlush: () => send({ type: 'collab-flush' }),
    collabUndo: () => send({ type: 'collab-undo' }),
    collabRedo: () => send({ type: 'collab-redo' }),
  }),
  onEditorMessage: (message: any) => {
    if (typeof message?.type === 'string' && message.type.startsWith('collab-')) {
      collabListeners.forEach((l) => l(message.type.slice(7), message.payload))
      return true
    }
    return false
  },
})