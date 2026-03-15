// src/lib/socket.ts
import { io, Socket } from 'socket.io-client'
import { getAccessToken } from './auth'

const URL = import.meta.env.VITE_API_BASE_URL

export const socket: Socket = io(`${URL}/notes`, {
  autoConnect: false,
  transports: ['websocket'],
  auth: (cb) => {
    const token = getAccessToken()
    cb({ token })
  },
})