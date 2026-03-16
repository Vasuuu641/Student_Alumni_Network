// src/lib/socket.ts
import { io, Socket } from 'socket.io-client'
import { getAccessToken } from './auth'

const RAW_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
const URL = RAW_URL.replace(/\/$/, '')

export const socket: Socket = io(`${URL}/notes`, {
  autoConnect: false,
  // Keep polling as a fallback so local dev still works behind proxies.
  transports: ['websocket', 'polling'],
  timeout: 10000,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 8000,
  auth: (cb) => {
    const token = getAccessToken()
    cb({ token })
  },
})