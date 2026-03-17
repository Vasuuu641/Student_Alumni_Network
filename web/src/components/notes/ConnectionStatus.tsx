// src/components/notes/ConnectionStatus.tsx
import { useEffect, useState } from 'react'
import { socket } from '../../lib/socket'

type ConnectionState = 'connected' | 'disconnected' | 'reconnecting'

export function ConnectionStatus() {
  const [state, setState] = useState<ConnectionState>(
    socket.connected ? 'connected' : 'disconnected',
  )

  useEffect(() => {
    const onConnect = () => setState('connected')
    const onDisconnect = () => setState('disconnected')
    const onReconnectAttempt = () => setState('reconnecting')
    const onReconnect = () => setState('connected')

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.io.on('reconnect_attempt', onReconnectAttempt)
    socket.io.on('reconnect', onReconnect)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.io.off('reconnect_attempt', onReconnectAttempt)
      socket.io.off('reconnect', onReconnect)
    }
  }, [])

  // Don't render anything when connected — no need to show
  // a "connected" banner on every note, only surface problems
  if (state === 'connected') return null

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-2 text-sm
        ${state === 'reconnecting'
          ? 'bg-yellow-50 text-yellow-700 border-b border-yellow-200'
          : 'bg-red-50 text-red-700 border-b border-red-200'
        }
      `}
    >
      <div
        className={`w-2 h-2 rounded-full shrink-0
          ${state === 'reconnecting'
            ? 'bg-yellow-400 animate-pulse'
            : 'bg-red-400'
          }
        `}
      />
      {state === 'reconnecting'
        ? 'Connection lost — reconnecting...'
        : 'You are offline. Changes may not be saved.'}
    </div>
  )
}